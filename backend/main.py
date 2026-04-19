"""
GenQuery backend — FastAPI application entry point.

Run with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

Environment variables:
  ALLOWED_ORIGINS  Comma-separated list of allowed CORS origins.
                   Defaults to "*" for development; set explicitly in production.
                   Example: ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import connection, metadata, query

app = FastAPI(
    title="GenQuery API",
    version="1.0.0",
    description="Safe SQL generation and execution from a visual AST for Greenplum / PostgreSQL",
)

# ── CORS ──────────────────────────────────────────────────────
_origins_env = os.getenv("ALLOWED_ORIGINS", "*").strip()
_allowed_origins: list[str] = (
    ["*"] if _origins_env == "*"
    else [o.strip() for o in _origins_env.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=_origins_env != "*",  # credentials require explicit origin
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Connection-Id"],
)

# ── Routes ────────────────────────────────────────────────────
app.include_router(connection.router)
app.include_router(metadata.router)
app.include_router(query.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "genquery-backend"}
