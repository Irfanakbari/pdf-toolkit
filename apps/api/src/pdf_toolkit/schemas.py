from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .config import ApiModel

TOOLS = {
    "merge",
    "split",
    "image-to-pdf",
    "docx-to-pdf",
    "excel-to-pdf",
    "powerpoint-to-pdf",
    "protect",
    "unlock",
    "compress",
    "grayscale",
}


class Model(BaseModel):
    model_config = ConfigDict(alias_generator=ApiModel.alias_generator, populate_by_name=True)


class CreateJobRequest(Model):
    tool: str

    @field_validator("tool")
    @classmethod
    def validate_tool(cls, value: str) -> str:
        if value not in TOOLS:
            raise ValueError("Unsupported tool")
        return value


class CreateJobResponse(Model):
    job_id: UUID = Field(serialization_alias="JobId")
    capability_token: str
    expires_at: datetime


class SubmitRequest(Model):
    options: dict[str, Any] = Field(default_factory=dict)


class FileInfo(Model):
    id: str
    name: str
    size: int
    content_type: str


class JobResponse(Model):
    job_id: UUID = Field(serialization_alias="JobId")
    tool: str
    status: str
    progress: int
    files: list[FileInfo]
    output_name: str | None
    output_size: int | None
    error_code: str | None
    expires_at: datetime


class MessageResponse(Model):
    message: str


class ErrorBody(Model):
    code: str
    message: str
    correlation_id: str
    details: Any | None = None


class ErrorResponse(Model):
    error: ErrorBody
