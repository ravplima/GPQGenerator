"""
Metadata endpoints — schemas, tables, columns.

All queries hit information_schema with parameterised values; no identifier
interpolation occurs here because schema/table names come from a validated
session, not raw user input.
"""
from fastapi import APIRouter, Depends, Query

from api.deps import require_connection
from core.db import _Session, open_cursor

router = APIRouter(prefix="/api/metadata", tags=["metadata"])


@router.get("/schemas")
async def list_schemas(session: _Session = Depends(require_connection)) -> list[str]:
    """Return non-system schemas visible to the connected role."""
    async with open_cursor(session.connection_id) as (_, cur):
        await cur.execute(
            """
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name NOT IN (
                'pg_catalog', 'information_schema', 'pg_toast',
                'gp_toolkit', 'pg_aoseg', 'pg_bitmapindex'
            )
              AND schema_name NOT LIKE 'pg_temp_%'
              AND schema_name NOT LIKE 'pg_toast_temp_%'
            ORDER BY schema_name
            """
        )
        rows = await cur.fetchall()
        return [r["schema_name"] for r in rows]


@router.get("/tables")
async def list_tables(
    schema: str = Query(..., min_length=1, max_length=128),
    session: _Session = Depends(require_connection),
) -> list[dict]:
    """Return tables and views in the given schema."""
    async with open_cursor(session.connection_id) as (_, cur):
        await cur.execute(
            """
            SELECT table_name   AS name,
                   table_schema AS schema,
                   table_type   AS "tableType"
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_type IN ('BASE TABLE', 'VIEW', 'FOREIGN')
            ORDER BY table_name
            """,
            (schema,),
        )
        return [dict(r) for r in await cur.fetchall()]


@router.get("/columns")
async def list_columns(
    schema: str = Query(..., min_length=1, max_length=128),
    table: str  = Query(..., min_length=1, max_length=128),
    session: _Session = Depends(require_connection),
) -> list[dict]:
    """Return columns with name, data type, and nullability."""
    async with open_cursor(session.connection_id) as (_, cur):
        await cur.execute(
            """
            SELECT column_name          AS name,
                   data_type            AS "dataType",
                   (is_nullable = 'YES') AS nullable
            FROM information_schema.columns
            WHERE table_schema = %s
              AND table_name   = %s
            ORDER BY ordinal_position
            """,
            (schema, table),
        )
        return [dict(r) for r in await cur.fetchall()]
