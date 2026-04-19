"""
In-memory session store + async connection helpers (psycopg 3).

Each session maps a UUID token to the user's database credentials.
Connections are opened fresh per-request so long-running Greenplum queries
don't block the event loop — psycopg3 AsyncConnection integrates natively
with uvicorn's asyncio loop.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

import psycopg
from psycopg.rows import dict_row

from .models import ConnectionConfig


@dataclass
class _Session:
    connection_id: str
    config: ConnectionConfig

    @property
    def _connparams(self) -> dict:
        c = self.config
        return dict(
            host=c.host,
            port=c.port,
            dbname=c.database,
            user=c.username,
            password=c.password,
            connect_timeout=10,
            application_name="genquery",
        )

    async def open(self) -> psycopg.AsyncConnection:
        """Open an async connection with dict_row factory and autocommit."""
        return await psycopg.AsyncConnection.connect(
            **self._connparams,
            row_factory=dict_row,
            autocommit=True,
        )

    async def test(self) -> None:
        """Raises psycopg.OperationalError if the DB is unreachable."""
        conn = await self.open()
        await conn.close()


# ── Session registry ──────────────────────────────────────────

_sessions: dict[str, _Session] = {}


def create_session(config: ConnectionConfig) -> str:
    s = _Session(connection_id=str(uuid.uuid4()), config=config)
    _sessions[s.connection_id] = s
    return s.connection_id


def get_session(connection_id: str) -> _Session:
    s = _sessions.get(connection_id)
    if s is None:
        raise KeyError(f"Sessão não encontrada: {connection_id!r}")
    return s


def remove_session(connection_id: str) -> None:
    _sessions.pop(connection_id, None)


# ── Async context manager ─────────────────────────────────────

@asynccontextmanager
async def open_cursor(
    connection_id: str,
) -> AsyncIterator[tuple[psycopg.AsyncConnection, psycopg.AsyncCursor]]:
    """
    Async context manager that yields (conn, cursor).
    The cursor uses the dict_row factory inherited from the connection.
    """
    session = get_session(connection_id)
    conn = await session.open()
    try:
        cur = conn.cursor()
        yield conn, cur
    finally:
        await conn.close()
