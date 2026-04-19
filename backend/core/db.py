"""
In-memory session store + async connection pool helpers (psycopg 3).

Each session owns an AsyncConnectionPool keyed to the user's credentials.
The pool is created lazily on first use and closed on disconnect.
This avoids the TCP handshake overhead of opening a fresh connection per
request while keeping credential isolation between sessions.
"""
from __future__ import annotations

import uuid
from asyncio import Lock
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import AsyncIterator

import psycopg
from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .models import ConnectionConfig


@dataclass
class _Session:
    connection_id: str
    config: ConnectionConfig
    _pool: AsyncConnectionPool | None = field(default=None, init=False, repr=False)
    _lock: Lock = field(default_factory=Lock, init=False, repr=False)

    @property
    def _conninfo(self) -> str:
        c = self.config
        return make_conninfo(
            host=c.host,
            port=c.port,
            dbname=c.database,
            user=c.username,
            password=c.password,
            connect_timeout=10,
            application_name="genquery",
        )

    async def get_pool(self) -> AsyncConnectionPool:
        """Return (creating if needed) the session's connection pool."""
        async with self._lock:
            if self._pool is None:
                self._pool = AsyncConnectionPool(
                    conninfo=self._conninfo,
                    kwargs={"row_factory": dict_row, "autocommit": True},
                    min_size=1,
                    max_size=5,
                    open=False,
                )
                await self._pool.open()
        return self._pool

    async def close_pool(self) -> None:
        async with self._lock:
            if self._pool is not None:
                await self._pool.close()
                self._pool = None

    async def test(self) -> None:
        """Raises psycopg.OperationalError if the DB is unreachable."""
        conn = await psycopg.AsyncConnection.connect(self._conninfo, connect_timeout=10)
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


async def remove_session(connection_id: str) -> None:
    session = _sessions.pop(connection_id, None)
    if session:
        await session.close_pool()


# ── Async context manager ─────────────────────────────────────

@asynccontextmanager
async def open_cursor(
    connection_id: str,
) -> AsyncIterator[tuple[psycopg.AsyncConnection, psycopg.AsyncCursor]]:
    """
    Yields (conn, cursor) from the session's connection pool.
    The connection is returned to the pool automatically on exit.
    """
    session = get_session(connection_id)
    pool = await session.get_pool()
    async with pool.connection() as conn:
        cur = conn.cursor()
        yield conn, cur
