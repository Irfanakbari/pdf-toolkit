import json
import shutil
import uuid

import dramatiq
from dramatiq.brokers.redis import RedisBroker
from sqlalchemy import select

from .config import get_settings
from .database import SessionLocal
from .models import Job, JobLog, JobStatus
from .processors.office import docx_to_pdf
from .processors.pdf import compress, images_to_pdf, merge, protect, split
from .storage import Storage

settings = get_settings()
dramatiq.set_broker(RedisBroker(url=settings.redis_url))
storage = Storage(settings.storage_root)


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
            output = output_dir / "hasil.pdf"
            options = dict(job.options)
            secret_path = storage.file(job.id, job.created_at, "work", "protect-options.json")
            if job.tool == "protect":
                options.update(json.loads(secret_path.read_text(encoding="utf-8")))
            options["GhostscriptBinary"] = settings.ghostscript_binary
            if job.tool == "merge":
                merge(inputs, output, options, settings.subprocess_timeout_seconds)
            elif job.tool == "split":
                parts = split(inputs, output_dir, options, settings.subprocess_timeout_seconds)
                archive = output_dir / "hasil-split.zip"
                base = str(archive.with_suffix(""))
                shutil.make_archive(base, "zip", output_dir)
                for part in parts:
                    part.unlink(missing_ok=True)
                output = archive
            elif job.tool == "image-to-pdf":
                images_to_pdf(inputs, output, options, settings.subprocess_timeout_seconds)
            elif job.tool == "protect":
                protect(inputs, output, options, settings.subprocess_timeout_seconds)
                secret_path.unlink(missing_ok=True)
                options.pop("Password", None)
            elif job.tool == "compress":
                compress(inputs, output, options, settings.subprocess_timeout_seconds)
            elif job.tool == "docx-to-pdf":
                output = docx_to_pdf(
                    inputs[0],
                    output_dir,
                    settings.libreoffice_binary,
                    settings.subprocess_timeout_seconds,
                )
            else:
                raise ValueError("Tool tidak didukung")
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
                JobLog(job_id=job.id, level="info", event="completed", message="Pemrosesan selesai")
            )
            await session.commit()
        except Exception as exc:
            await session.rollback()
            job = await session.get(Job, uuid.UUID(job_id))
            if job and job.status != JobStatus.CANCELLED:
                job.status = JobStatus.FAILED
                job.error_code = str(exc) if str(exc).isupper() else "PROCESSING_FAILED"
                job.lease_owner = None
                job.lease_expires_at = None
                session.add(
                    JobLog(job_id=job.id, level="error", event="failed", message="Pemrosesan gagal")
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
