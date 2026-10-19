import asyncio
import json
import logging
import os
import queue
import shutil
import tempfile
import time
import uuid
import zipfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

import dramatiq
import pikepdf
from dramatiq.brokers.redis import RedisBroker
from sqlalchemy import select

from .config import get_settings
from .database import WorkerSessionLocal
from .models import Job, JobLog, JobStatus
from .processors.office import office_to_pdf
from .processors.pdf import compress, grayscale, images_to_pdf, merge, protect, split, unlock
from .processors.reverse import pdf_to_excel, pdf_to_powerpoint, pdf_to_word
from .storage import Storage

settings = get_settings()
dramatiq.set_broker(RedisBroker(url=settings.redis_url))
storage = Storage(settings.storage_root)
logger = logging.getLogger(__name__)


def output_name(tool: str, original_name: str) -> str:
    stem = Path(original_name).stem.strip() if original_name else ""
    extension = {
        "split": ".zip",
        "pdf-to-word": ".docx",
        "pdf-to-excel": ".xlsx",
        "pdf-to-powerpoint": ".pptx",
    }.get(tool, ".pdf")
    return f"{stem or 'document'}{extension}"


class ProgressReporter:
    def __init__(self, job_id: uuid.UUID, minimum_interval: float = 1.0):
        self.job_id = job_id
        self.minimum_interval = minimum_interval
        self.progress = 0
        self.stage: str | None = None
        self.last_write = 0.0

    async def update(self, progress: int, stage: str, force: bool = False) -> bool:
        progress = max(self.progress, min(progress, 100))
        now = time.monotonic()
        if not force and progress == self.progress and stage == self.stage:
            return False
        if not force and now - self.last_write < self.minimum_interval:
            return False
        async with WorkerSessionLocal() as session:
            job = await session.get(Job, self.job_id)
            if not job or job.status == JobStatus.CANCELLED:
                return False
            job.progress = max(job.progress, progress)
            job.stage = stage
            job.lease_expires_at = datetime.now(UTC) + timedelta(minutes=15)
            await session.commit()
            self.progress = job.progress
            self.stage = stage
            self.last_write = now
            return True


async def _cancelled(job_id: uuid.UUID) -> bool:
    async with WorkerSessionLocal() as session:
        job = await session.get(Job, job_id)
        return not job or job.status == JobStatus.CANCELLED


async def _require_active(job_id: uuid.UUID) -> None:
    if await _cancelled(job_id):
        raise asyncio.CancelledError


def validate_output(path: Path, expected_suffix: str) -> None:
    if (
        path.suffix.lower() != expected_suffix.lower()
        or not path.is_file()
        or path.stat().st_size <= 0
    ):
        raise RuntimeError("INVALID_OUTPUT")
    if expected_suffix == ".pdf":
        with pikepdf.open(path) as pdf:
            if not len(pdf.pages):
                raise RuntimeError("INVALID_OUTPUT")
    elif expected_suffix == ".zip":
        with zipfile.ZipFile(path) as archive:
            if archive.testzip() is not None or not archive.namelist():
                raise RuntimeError("INVALID_OUTPUT")
    elif expected_suffix in {".docx", ".xlsx", ".pptx"}:
        if not zipfile.is_zipfile(path):
            raise RuntimeError("INVALID_OUTPUT")
        with zipfile.ZipFile(path) as archive:
            if archive.testzip() is not None:
                raise RuntimeError("INVALID_OUTPUT")


def publish_output(local_output: Path, destination: Path) -> int:
    with local_output.open("rb") as source:
        return storage.atomic_write(destination, source)


async def _run_with_progress(function, reporter: ProgressReporter, *args, callback=False):
    updates: queue.SimpleQueue[tuple[int, int]] = queue.SimpleQueue()

    def progress(done: int, total: int) -> None:
        updates.put((done, total))

    call_args = (*args, progress) if callback else args
    task = asyncio.create_task(asyncio.to_thread(function, *call_args))
    started = time.monotonic()
    try:
        while not task.done():
            await asyncio.sleep(1.0)
            await _require_active(reporter.job_id)
            measured = None
            while not updates.empty():
                done, total = updates.get_nowait()
                measured = 25 + round(60 * done / max(total, 1))
            heartbeat = min(82, 30 + int((time.monotonic() - started) / 2))
            await reporter.update(measured if measured is not None else heartbeat, "Processing")
        return await task
    except asyncio.CancelledError:
        await task
        raise


async def _process(job_id: str) -> None:
    identifier = uuid.UUID(job_id)
    reporter = ProgressReporter(identifier)
    secret_path: Path | None = None
    job: Job | None = None
    try:
        async with WorkerSessionLocal() as session:
            job = await session.scalar(select(Job).where(Job.id == identifier).with_for_update())
            if not job or job.status != JobStatus.QUEUED:
                return
            job.status = JobStatus.PROCESSING
            job.progress = 10
            job.stage = "Validating"
            job.lease_owner = f"worker:{uuid.uuid4()}"
            job.lease_expires_at = datetime.now(UTC) + timedelta(minutes=15)
            await session.commit()
            files = list(job.files)
            options = dict(job.options)
            tool = job.tool
            created_at = job.created_at

        reporter.progress = 10
        reporter.stage = "Validating"
        await _require_active(identifier)
        nas_inputs = [
            storage.file(identifier, created_at, "input", item["StoredName"]) for item in files
        ]
        if not nas_inputs or any(not item.is_file() for item in nas_inputs):
            raise RuntimeError("INPUT_MISSING")
        secret_path = storage.file(identifier, created_at, "work", "protect-options.json")
        if tool in {"protect", "unlock"} and secret_path.is_file():
            options.update(json.loads(secret_path.read_text(encoding="utf-8")))
        options["GhostscriptBinary"] = settings.ghostscript_binary

        with tempfile.TemporaryDirectory(prefix=f"pdf-toolkit-{identifier}-") as workspace_name:
            workspace = Path(workspace_name)
            input_dir = workspace / "input"
            output_dir = workspace / "output"
            input_dir.mkdir()
            output_dir.mkdir()
            await reporter.update(15, "Preparing", force=True)
            inputs = []
            for index, source in enumerate(nas_inputs, 1):
                await _require_active(identifier)
                destination = input_dir / f"{index:03d}-{source.name}"
                await asyncio.to_thread(shutil.copy2, source, destination)
                inputs.append(destination)
                await reporter.update(15 + round(10 * index / len(nas_inputs)), "Preparing")

            desired_name = output_name(tool, files[0]["Name"])
            output = output_dir / desired_name
            await reporter.update(25, "Processing", force=True)
            timeout = settings.subprocess_timeout_seconds
            if tool == "merge":
                await _run_with_progress(
                    merge, reporter, inputs, output, options, timeout, callback=True
                )
            elif tool == "split":
                parts = await _run_with_progress(
                    split, reporter, inputs, output_dir, options, timeout, callback=True
                )
                stem = Path(files[0]["Name"]).stem.strip() or "document"
                if len(parts) == 1:
                    output = output_dir / f"{stem}.pdf"
                    os.replace(parts[0], output)
                else:
                    output = output_dir / f"{stem}.zip"
                    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                        for index, part in enumerate(parts, 1):
                            archive.write(part, arcname=f"{stem}-{index}.pdf")
            elif tool == "image-to-pdf":
                await _run_with_progress(
                    images_to_pdf, reporter, inputs, output, options, timeout, callback=True
                )
            elif tool == "protect":
                await _run_with_progress(protect, reporter, inputs, output, options, timeout)
            elif tool == "unlock":
                await _run_with_progress(unlock, reporter, inputs, output, options, timeout)
            elif tool == "compress":
                await _run_with_progress(compress, reporter, inputs, output, options, timeout)
            elif tool == "grayscale":
                await _run_with_progress(grayscale, reporter, inputs, output, options, timeout)
            elif tool in {"docx-to-pdf", "excel-to-pdf", "powerpoint-to-pdf"}:
                converted = await _run_with_progress(
                    office_to_pdf,
                    reporter,
                    inputs[0],
                    output_dir,
                    settings.libreoffice_binary,
                    timeout,
                )
                if converted != output:
                    os.replace(converted, output)
            elif tool == "pdf-to-word":
                await _run_with_progress(pdf_to_word, reporter, inputs[0], output)
            elif tool == "pdf-to-excel":
                await _run_with_progress(pdf_to_excel, reporter, inputs[0], output, callback=True)
            elif tool == "pdf-to-powerpoint":
                await _run_with_progress(
                    pdf_to_powerpoint, reporter, inputs[0], output, callback=True
                )
            else:
                raise ValueError("Unsupported tool")

            await _require_active(identifier)
            await reporter.update(90, "Validating output", force=True)
            await asyncio.to_thread(validate_output, output, output.suffix)
            await _require_active(identifier)
            await reporter.update(95, "Publishing", force=True)
            destination = storage.file(identifier, created_at, "output", output.name)
            output_size = await asyncio.to_thread(publish_output, output, destination)

        async with WorkerSessionLocal() as session:
            current = await session.get(Job, identifier)
            if not current or current.status == JobStatus.CANCELLED:
                return
            current.status = JobStatus.COMPLETED
            current.progress = 100
            current.stage = "Completed"
            current.output_name = output.name
            current.output_size = output_size
            current.lease_owner = None
            current.lease_expires_at = None
            session.add(
                JobLog(
                    job_id=identifier,
                    level="info",
                    event="completed",
                    message="Processing completed",
                )
            )
            await session.commit()
    except asyncio.CancelledError:
        return
    except Exception as exc:
        logger.exception(
            "PDF job processing failed",
            extra={
                "job_id": job_id,
                "tool": job.tool if job else "unknown",
                "exception_type": type(exc).__name__,
            },
        )
        async with WorkerSessionLocal() as session:
            current = await session.get(Job, identifier)
            if current and current.status != JobStatus.CANCELLED:
                current.status = JobStatus.FAILED
                diagnostic = str(exc)
                current.error_code = (
                    diagnostic[:64]
                    if diagnostic
                    in {
                        "INVALID_IMAGE",
                        "INVALID_PAGE_SIZE",
                        "INVALID_PASSWORD",
                        "INVALID_OUTPUT",
                        "INPUT_MISSING",
                    }
                    else "PROCESSING_FAILED"
                )
                current.lease_owner = None
                current.lease_expires_at = None
                session.add(
                    JobLog(
                        job_id=identifier,
                        level="error",
                        event="failed",
                        message="Processing failed",
                    )
                )
                await session.commit()
    finally:
        if secret_path is not None:
            secret_path.unlink(missing_ok=True)


@dramatiq.actor(queue_name="pdf", max_retries=1, time_limit=900_000)
def process_pdf(job_id: str) -> None:
    asyncio.run(_process(job_id))


@dramatiq.actor(queue_name="office", max_retries=1, time_limit=900_000)
def process_office(job_id: str) -> None:
    asyncio.run(_process(job_id))
