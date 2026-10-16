import os
import re
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def secure_name(name: str, fallback: str = "file") -> str:
    cleaned = SAFE_NAME.sub("_", Path(name).name).strip("._")
    return (cleaned or fallback)[:180]


class Storage:
    def __init__(self, root: Path):
        self.root = root.resolve()

    def job_root(self, job_id: UUID, created_at: datetime) -> Path:
        date = created_at.astimezone(UTC)
        return self._inside(self.root / date.strftime("%Y/%m/%d") / str(job_id))

    def directory(self, job_id: UUID, created_at: datetime, kind: str) -> Path:
        if kind not in {"input", "work", "output"}:
            raise ValueError("Invalid storage directory")
        path = self._inside(self.job_root(job_id, created_at) / kind)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def file(self, job_id: UUID, created_at: datetime, kind: str, name: str) -> Path:
        return self._inside(self.directory(job_id, created_at, kind) / secure_name(name))

    def atomic_write(self, destination: Path, source, max_bytes: int | None = None) -> int:
        destination = self._inside(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(prefix=".upload-", dir=destination.parent)
        size = 0
        try:
            with os.fdopen(fd, "wb") as target:
                while chunk := source.read(1024 * 1024):
                    size += len(chunk)
                    if max_bytes is not None and size > max_bytes:
                        raise ValueError("File exceeds maximum size")
                    target.write(chunk)
                target.flush()
                os.fsync(target.fileno())
            os.replace(temp_name, destination)
            return size
        except BaseException:
            Path(temp_name).unlink(missing_ok=True)
            raise

    def atomic_write_bytes(self, destination: Path, content: bytes) -> None:
        from io import BytesIO

        self.atomic_write(destination, BytesIO(content), max_bytes=len(content))

    def ensure_capacity(self, incoming: int, minimum_free: int) -> None:
        if shutil.disk_usage(self.root).free - incoming < minimum_free:
            raise OSError("Insufficient storage capacity")

    def remove_job(self, job_id: UUID, created_at: datetime) -> None:
        shutil.rmtree(self.job_root(job_id, created_at), ignore_errors=True)

    def _inside(self, path: Path) -> Path:
        resolved = path.resolve()
        if resolved != self.root and self.root not in resolved.parents:
            raise ValueError("Path escapes storage root")
        return resolved
