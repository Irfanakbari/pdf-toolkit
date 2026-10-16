from datetime import UTC, datetime

from sqlalchemy import select

from .config import get_settings
from .database import SessionLocal
from .models import Job, JobStatus
from .storage import Storage


async def cleanup() -> int:
    settings = get_settings()
    storage = Storage(settings.storage_root)
    count = 0
    async with SessionLocal() as session:
        now = datetime.now(UTC)
        jobs = (
            await session.scalars(
                select(Job).where(
                    Job.expires_at <= now,
                    (Job.lease_expires_at.is_(None)) | (Job.lease_expires_at <= now),
                )
            )
        ).all()
        for job in jobs:
            storage.remove_job(job.id, job.created_at)
            job.status = JobStatus.EXPIRED
            job.files = []
            job.output_name = None
            job.output_size = None
            count += 1
        await session.commit()
    return count


def main() -> None:
    import asyncio
    import time

    while True:
        asyncio.run(cleanup())
        time.sleep(3600)


if __name__ == "__main__":
    main()
