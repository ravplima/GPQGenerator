"""
Query execution endpoint.

Flow:
  1. Validate the QueryAST with Pydantic
  2. Build safe SQL via sql_builder (psycopg.sql — no injection possible)
  3. Apply Greenplum MPP SET commands (optimizer, statement_mem)
  4. Execute with psycopg3 async parameterised binding
  5. Return rows + column metadata + generated SQL
"""
from __future__ import annotations

import time
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

import psycopg
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_connection
from core.db import _Session, open_cursor
from core.models import ColumnInfo, QueryAST, QueryResult
from core.sql_builder import build_sql, mpp_set_commands

router = APIRouter(prefix="/api/query", tags=["query"])

MAX_ROWS = 10_000


def _serialize(v: Any) -> Any:
    """Convert any PostgreSQL value to a JSON-safe Python type."""
    if v is None:
        return None
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, timedelta):
        return str(v)
    if isinstance(v, memoryview):
        return v.hex()
    # list/dict already serialisable (arrays, JSONB)
    return v


@router.post("/execute", response_model=QueryResult)
async def execute_query(
    ast: QueryAST,
    session: _Session = Depends(require_connection),
) -> QueryResult:

    # ── 1. Build SQL from AST (raises ValueError on invalid input) ─
    try:
        query_composable, params = build_sql(ast)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"AST inválido: {exc}",
        )

    async with open_cursor(session.connection_id) as (conn, cur):

        # Render to string for the UI — as_string needs the connection for
        # client-encoding-aware quoting (same API as psycopg2).
        generated_sql: str = query_composable.as_string(conn)

        # ── 2. Apply Greenplum MPP session settings ────────────
        for cmd in mpp_set_commands(ast.mpp):
            try:
                await cur.execute(cmd)
            except psycopg.Error:
                # Non-Greenplum servers don't know these GUCs; ignore silently.
                pass

        # ── 3. Execute with parameterised binding ──────────────
        try:
            t0 = time.perf_counter()
            await cur.execute(query_composable, params)
            elapsed_ms = (time.perf_counter() - t0) * 1000
        except psycopg.Error as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Erro na execução: {exc.diag.message_primary or str(exc)}",
            )

        # ── 4. Column metadata ─────────────────────────────────
        col_meta: list[ColumnInfo] = []
        if cur.description:
            for desc in cur.description:
                # desc.type_code is an OID (int) in psycopg3
                col_meta.append(ColumnInfo(name=desc.name, type=str(desc.type_code)))

        # ── 5. Rows (bounded) ──────────────────────────────────
        raw_rows = await cur.fetchmany(MAX_ROWS)
        rows = [[_serialize(v) for v in row.values()] for row in raw_rows]

    return QueryResult(
        columns=col_meta,
        rows=rows,
        row_count=len(rows),
        execution_time_ms=round(elapsed_ms, 2),
        generated_sql=generated_sql,
    )
