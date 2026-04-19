"""FastAPI dependencies shared across routes."""
from fastapi import Header, HTTPException, status
from core.db import get_session, _Session


async def require_connection(x_connection_id: str = Header(...)) -> _Session:
    """
    Extracts the session from the X-Connection-Id header.
    Raises 401 if missing or unknown.
    """
    try:
        return get_session(x_connection_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão não encontrada. Reconecte ao banco de dados.",
        )
