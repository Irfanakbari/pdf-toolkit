FROM ghcr.io/astral-sh/uv:0.9.5 AS uv

FROM python:3.13-slim-bookworm AS builder
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev --no-install-project
COPY apps/api/src ./src
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev

FROM python:3.13-slim-bookworm AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates fonts-dejavu-core fonts-liberation ghostscript libmagic1 \
        libreoffice-writer libreoffice-calc libreoffice-impress qpdf tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 app \
    && useradd --uid 1000 --gid app --create-home --home-dir /home/app app
WORKDIR /app
COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/alembic ./alembic
COPY --from=builder --chown=app:app /app/src ./src
RUN mkdir -p /storage /home/app/.cache /home/app/.config /tmp/libreoffice \
    && chown -R app:app /app /storage /home/app /tmp/libreoffice
USER app
ENV HOME=/home/app \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app/src \
    TMPDIR=/tmp/libreoffice \
    PYTHONUNBUFFERED=1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "pdf_toolkit.main:app", "--host", "0.0.0.0", "--port", "8000"]
