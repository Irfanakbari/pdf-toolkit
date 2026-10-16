import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .api.jobs import router as jobs_router
from .config import get_settings
from .database import SessionLocal

settings = get_settings()
app = FastAPI(title="PDF Toolkit API", version="1.0.0", docs_url="/api/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Correlation-Id"],
)
app.include_router(jobs_router)


@app.middleware("http")
async def correlation(request: Request, call_next):
    request.state.correlation_id = request.headers.get("X-Correlation-Id", str(uuid.uuid4()))[:128]
    response = await call_next(request)
    response.headers["X-Correlation-Id"] = request.state.correlation_id
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "Error": {
                "Code": "VALIDATION_ERROR",
                "Message": "Permintaan tidak valid",
                "CorrelationId": request.state.correlation_id,
                "Details": jsonable_encoder(exc.errors()),
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logging.exception(
        "Unhandled request error", extra={"correlation_id": request.state.correlation_id}
    )
    return JSONResponse(
        status_code=500,
        content={
            "Error": {
                "Code": "INTERNAL_ERROR",
                "Message": "Terjadi kesalahan internal",
                "CorrelationId": request.state.correlation_id,
            }
        },
    )


@app.get("/health/live")
async def live():
    return {"Status": "ok"}


@app.get("/health/ready")
async def ready():
    settings.storage_root.mkdir(parents=True, exist_ok=True)
    async with SessionLocal() as session:
        await session.execute(text("SELECT 1"))
    return {"Status": "ready"}
