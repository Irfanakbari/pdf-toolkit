import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_session
from .models import Job, JobStatus
from .security import verify_capability


async def authorized_job(
    request: Request,
    job_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    x_capability_token: str | None = Header(default=None),
) -> Job:
    job = await session.get(Job, job_id)
    if (
        not job
        or not x_capability_token
        or not verify_capability(x_capability_token, job.token_hash)
    ):
        raise HTTPException(
            status_code=404, detail={"Code": "JOB_NOT_FOUND", "Message": "Job tidak ditemukan"}
        )
    if job.expires_at <= datetime.now(UTC) or job.status == JobStatus.EXPIRED:
        raise HTTPException(
            status_code=410, detail={"Code": "JOB_EXPIRED", "Message": "Job telah kedaluwarsa"}
        )
    request.state.job = job
    return job


def expires_in(hours: int) -> datetime:
    return datetime.now(UTC) + timedelta(hours=hours)
