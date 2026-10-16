import json
import os
import uuid

import magic
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_session
from ..dependencies import authorized_job, expires_in
from ..models import Job, JobLog, JobStatus
from ..schemas import (
    CreateJobRequest,
    CreateJobResponse,
    JobResponse,
    MessageResponse,
    SubmitRequest,
)
from ..security import create_capability
from ..storage import Storage, secure_name
from ..tasks import process_office, process_pdf

router = APIRouter(prefix="/api/v1/jobs", tags=["Jobs"])
settings = get_settings()
storage = Storage(settings.storage_root)
ALLOWED = {
    "merge": {"application/pdf"},
    "split": {"application/pdf"},
    "protect": {"application/pdf"},
    "unlock": {"application/pdf"},
    "compress": {"application/pdf"},
    "grayscale": {"application/pdf"},
    "docx-to-pdf": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/vnd.oasis.opendocument.text",
        "application/zip",
        "application/octet-stream",
    },
    "excel-to-pdf": {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/vnd.oasis.opendocument.spreadsheet",
        "text/csv",
        "application/csv",
        "text/plain",
        "application/zip",
        "application/octet-stream",
    },
    "powerpoint-to-pdf": {
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-powerpoint",
        "application/vnd.oasis.opendocument.presentation",
        "application/zip",
        "application/octet-stream",
    },
    "image-to-pdf": {"image/jpeg", "image/png", "image/webp"},
}


def response(job: Job) -> JobResponse:
    return JobResponse(
        job_id=job.id,
        tool=job.tool,
        status=job.status.value,
        progress=job.progress,
        files=job.files,
        output_name=job.output_name,
        output_size=job.output_size,
        error_code=job.error_code,
        expires_at=job.expires_at,
    )


@router.post("", response_model=CreateJobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(body: CreateJobRequest, session: AsyncSession = Depends(get_session)):
    token, digest = create_capability()
    job = Job(tool=body.tool, token_hash=digest, expires_at=expires_in(settings.job_ttl_hours))
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return CreateJobResponse(job_id=job.id, capability_token=token, expires_at=job.expires_at)


@router.post("/{job_id}/files", response_model=JobResponse)
async def upload_file(
    file: UploadFile = File(...),
    job: Job = Depends(authorized_job),
    session: AsyncSession = Depends(get_session),
):
    if job.status not in {JobStatus.CREATED, JobStatus.UPLOADING}:
        raise HTTPException(
            409, detail={"Code": "INVALID_STATE", "Message": "Upload is closed"}
        )
    files = list(job.files)
    if len(files) >= 20:
        raise HTTPException(413, detail={"Code": "TOO_MANY_FILES", "Message": "Maximum 20 files allowed"})
    name = secure_name(file.filename or "file")
    stored = f"{uuid.uuid4().hex}_{name}"
    destination = storage.file(job.id, job.created_at, "input", stored)
    storage.ensure_capacity(settings.max_file_bytes, settings.min_free_bytes)
    remaining_job_bytes = settings.max_job_bytes - sum(item["Size"] for item in files)
    upload_limit = min(settings.max_file_bytes, remaining_job_bytes)
    if upload_limit <= 0:
        raise HTTPException(
            413, detail={"Code": "FILE_TOO_LARGE", "Message": "Job size exceeds limit"}
        )
    try:
        size = storage.atomic_write(destination, file.file, max_bytes=upload_limit)
    except ValueError as exc:
        raise HTTPException(
            413, detail={"Code": "FILE_TOO_LARGE", "Message": "File size exceeds limit"}
        ) from exc
    mime = magic.from_file(str(destination), mime=True)
    if mime not in ALLOWED[job.tool]:
        destination.unlink(missing_ok=True)
        raise HTTPException(
            415, detail={"Code": "INVALID_FILE_TYPE", "Message": "Invalid file type"}
        )
    files.append(
        {
            "Id": uuid.uuid4().hex,
            "Name": name,
            "StoredName": stored,
            "Size": size,
            "ContentType": mime,
        }
    )
    job.files = files
    job.status = JobStatus.UPLOADING
    await session.commit()
    return response(job)


@router.post("/{job_id}/submit", response_model=JobResponse)
async def submit(
    body: SubmitRequest,
    job: Job = Depends(authorized_job),
    session: AsyncSession = Depends(get_session),
):
    if job.status not in {JobStatus.CREATED, JobStatus.UPLOADING} or not job.files:
        raise HTTPException(
            409, detail={"Code": "INVALID_STATE", "Message": "Job is not ready to submit"}
        )
    if job.tool == "merge" and len(job.files) < 2:
        raise HTTPException(
            422, detail={"Code": "FILES_REQUIRED", "Message": "Merge requires at least 2 PDF files"}
        )
    options = dict(body.options)
    password = options.pop("Password", None)
    if job.tool in {"protect", "unlock"}:
        min_len = 8 if job.tool == "protect" else 1
        if not isinstance(password, str) or not min_len <= len(password) <= 128:
            raise HTTPException(
                422,
                detail={"Code": "INVALID_PASSWORD", "Message": f"Password must be at least {min_len} characters"},
            )
        secret_path = storage.file(job.id, job.created_at, "work", "protect-options.json")
        storage.atomic_write_bytes(
            secret_path,
            json.dumps({"Password": password}).encode("utf-8"),
        )
        os.chmod(secret_path, 0o600)
    job.options = options
    job.status = JobStatus.QUEUED
    job.progress = 5
    session.add(JobLog(job_id=job.id, level="info", event="queued", message="Job queued"))
    await session.commit()
    (process_office if job.tool in {"docx-to-pdf", "excel-to-pdf", "powerpoint-to-pdf"} else process_pdf).send(str(job.id))
    return response(job)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job: Job = Depends(authorized_job)):
    return response(job)


@router.post("/{job_id}/cancel", response_model=MessageResponse)
async def cancel(job: Job = Depends(authorized_job), session: AsyncSession = Depends(get_session)):
    if job.status in {JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.EXPIRED}:
        raise HTTPException(
            409, detail={"Code": "INVALID_STATE", "Message": "Job cannot be canceled"}
        )
    job.status = JobStatus.CANCELLED
    await session.commit()
    return MessageResponse(message="Job canceled")


@router.get("/{job_id}/download")
async def download(job: Job = Depends(authorized_job)):
    if job.status != JobStatus.COMPLETED or not job.output_name:
        raise HTTPException(409, detail={"Code": "NOT_READY", "Message": "Output is not ready"})
    path = storage.file(job.id, job.created_at, "output", job.output_name)
    if not path.is_file():
        raise HTTPException(
            404, detail={"Code": "OUTPUT_MISSING", "Message": "Output file not found"}
        )
    return FileResponse(
        path,
        filename=job.output_name,
        media_type="application/zip" if path.suffix == ".zip" else "application/pdf",
    )
