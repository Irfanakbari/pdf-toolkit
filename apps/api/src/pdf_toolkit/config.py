from functools import lru_cache
from pathlib import Path

from pydantic import AliasGenerator, Field
from pydantic.alias_generators import to_pascal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+asyncpg://pdf:pdf@localhost:5432/pdf_toolkit"
    redis_url: str = "redis://localhost:6379/0"
    storage_root: Path = Path("./storage")
    cors_origins: str = "http://localhost:3000"
    max_file_bytes: int = 100 * 1024 * 1024
    max_job_bytes: int = 500 * 1024 * 1024
    min_free_bytes: int = 1024 * 1024 * 1024
    job_ttl_hours: int = 24
    subprocess_timeout_seconds: int = 600
    libreoffice_binary: str = "soffice"
    ghostscript_binary: str = "gs"


@lru_cache
def get_settings() -> Settings:
    return Settings()


class ApiModel:
    alias_generator = AliasGenerator(validation_alias=to_pascal, serialization_alias=to_pascal)
    populate_by_name = True


ID_FIELD = Field(serialization_alias="Id")
