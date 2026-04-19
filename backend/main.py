"""
GenQuery backend — FastAPI application entry point.

Run with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import connection, metadata, query

app = FastAPI(
    title="GenQuery API",
    version="1.0.0",
    description="Safe SQL generation and execution from a visual AST for Greenplum / PostgreSQL",
)

# ── CORS ──────────────────────────────────────────────────────
# In production, replace "*" with the frontend origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
