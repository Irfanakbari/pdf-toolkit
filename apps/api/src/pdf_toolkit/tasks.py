import json
import logging
import os
import uuid
import zipfile
from pathlib import Path

import dramatiq
from dramatiq.brokers.redis import RedisBroker
from sqlalchemy import select

from .config import get_settings
from .database import SessionLocal
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
    if not stem:
        stem = "document"
    ext_map = {
        "split": ".zip",
        "pdf-to-word": ".docx",
        "pdf-to-excel": ".xlsx",
        "pdf-to-powerpoint": ".pptx",
    }
    extension = ext_map.get(tool, ".pdf")
    return f"{stem}{extension}"


async def _process(job_id: str) -> None:
    async with SessionLocal() as session:
        job = await session.scalar(select(Job).where(Job.id == uuid.UUID(job_id)).with_for_update())
        if not job or job.status != JobStatus.QUEUED:
            return
        job.status = JobStatus.PROCESSING
        job.progress = 10
        job.lease_owner = f"worker:{uuid.uuid4()}"
        from datetime import UTC, datetime, timedelta

        job.lease_expires_at = datetime.now(UTC) + timedelta(minutes=15)
        await session.commit()
        try:
            inputs = [
                storage.file(job.id, job.created_at, "input", item["StoredName"])
                for item in job.files
            ]
            output_dir = storage.directory(job.id, job.created_at, "output")
            desired_name = output_name(job.tool, job.files[0]["Name"])
            output = output_dir / desired_name
            options = dict(job.options)
            secret_path = storage.file(job.id, job.created_at, "work", "protect-options.json")
            if job.tool in {"protect", "unlock"} and secret_path.is_file():
                options.update(json.loads(secret_path.read_text(encoding="utf-8")))
            options["GhostscriptBinary"] = settings.ghostscript_binary
            job.progress = 35
            await session.commit()
            if job.tool == "merge":
                merge(inputs, output, options, settings.subprocess_timeout_seconds)
            elif job.tool == "split":
                stem = Path(job.files[0]["Name"]).stem.strip() or "document"
                parts = split(inputs, output_dir, options, settings.subprocess_timeout_seconds)
                if len(parts) == 1:
                    output = output_dir / f"{stem}.pdf"
                    if parts[0] != output:
                        os.replace(parts[0], output)
                else:
                    output = output_dir / f"{stem}.zip"
                    temp_zip = output_dir / f".{uuid.uuid4().hex}.zip"
                    with zipfile.ZipFile(temp_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                        for idx, part in enumerate(parts, 1):
                            zf.write(part, arcname=f"{stem}-{idx}.pdf")
                    for part in parts:
                        part.unlink(missing_ok=True)
                    os.replace(temp_zip, output)
            elif job.tool == "image-to-pdf":
                images_to_pdf(inputs, output, options, settings.subprocess_timeout_seconds)
            elif job.tool == "protect":
                protect(inputs, output, options, settings.subprocess_timeout_seconds)
                secret_path.unlink(missing_ok=True)
                options.pop("Password", None)
            elif job.tool == "unlock":
                unlock(inputs, output, options, settings.subprocess_timeout_seconds)
                secret_path.unlink(missing_ok=True)
                options.pop("Password", None)
            elif job.tool == "compress":
                compress(inputs, output, options, settings.subprocess_timeout_seconds)
            elif job.tool == "grayscale":
                grayscale(inputs, output, options, settings.subprocess_timeout_seconds)
            elif job.tool in {"docx-to-pdf", "excel-to-pdf", "powerpoint-to-pdf"}:
                output = office_to_pdf(
                    inputs[0],
                    output_dir,
                    settings.libreoffice_binary,
                    settings.subprocess_timeout_seconds,
                )
            elif job.tool == "pdf-to-word":
                pdf_to_word(inputs[0], output)
            elif job.tool == "pdf-to-excel":
                pdf_to_excel(inputs[0], output)
            elif job.tool == "pdf-to-powerpoint":
                pdf_to_powerpoint(inputs[0], output)
            else:
                raise ValueError("Unsupported tool")
            await session.refresh(job)
            if job.status == JobStatus.CANCELLED:
                output.unlink(missing_ok=True)
                return
            job.status = JobStatus.COMPLETED
            job.progress = 100
            job.output_name = output.name
            job.output_size = output.stat().st_size
            job.lease_owner = None
            job.lease_expires_at = None
            session.add(
                JobLog(job_id=job.id, level="info", event="completed", message="Processing completed")
            )
            await session.commit()
        except Exception as exc:
            logger.exception(
                "PDF job processing failed",
                extra={
                    "job_id": job_id,
                    "tool": job.tool if job else "unknown",
                    "exception_type": type(exc).__name__,
                },
            )
            await session.rollback()
            job = await session.get(Job, uuid.UUID(job_id))
            if job and job.status != JobStatus.CANCELLED:
                job.status = JobStatus.FAILED
                diagnostic = str(exc)
                job.error_code = (
                    diagnostic[:64]
                    if diagnostic in {"INVALID_IMAGE", "INVALID_PAGE_SIZE"}
                    else "PROCESSING_FAILED"
                )
                job.lease_owner = None
                job.lease_expires_at = None
                session.add(
                    JobLog(job_id=job.id, level="error", event="failed", message="Processing failed")
                )
                await session.commit()


@dramatiq.actor(queue_name="pdf", max_retries=1, time_limit=900_000)
def process_pdf(job_id: str) -> None:
    import asyncio

    asyncio.run(_process(job_id))


@dramatiq.actor(queue_name="office", max_retries=1, time_limit=900_000)
def process_office(job_id: str) -> None:
    import asyncio

    asyncio.run(_process(job_id))
