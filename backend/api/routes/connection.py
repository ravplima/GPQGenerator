import psycopg
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_connection
from core.db import _Session, create_session, remove_session
from core.models import ConnectionConfig, ConnectionResult

router = APIRouter(prefix="/api/connection", tags=["connection"])


@router.post("/test", response_model=ConnectionResult)
async def test_connection(config: ConnectionConfig) -> ConnectionResult:
    """
    Validates credentials without persisting a session.
    Returns {ok: true} on success or {ok: false, error: "..."} on failure.
    """
    tmp = _Session(connection_id="test", config=config)
    try:
        await tmp.test()
        return ConnectionResult(ok=True)
    except psycopg.OperationalError as exc:
        return ConnectionResult(ok=False, error=str(exc).strip())
    except Exception as exc:
        return ConnectionResult(ok=False, error=str(exc))


@router.post("", response_model=ConnectionResult, status_code=status.HTTP_201_CREATED)
async def save_connection(config: ConnectionConfig) -> ConnectionResult:
    """
    Validates and persists the connection; returns the session token.
    The frontend must echo X-Connection-Id: <token> on all subsequent requests.
    """
    tmp = _Session(connection_id="probe", config=config)
    try:
        await tmp.test()
    except psycopg.OperationalError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Falha ao conectar: {exc}".strip(),
        )

    conn_id = create_session(config)
    return ConnectionResult(ok=True, connection_id=conn_id)


@router.delete("")
async def disconnect(session: _Session = Depends(require_connection)) -> dict:
    await remove_session(session.connection_id)
    return {"ok": True}
