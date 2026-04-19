"""
Pydantic models that mirror the QueryAST produced by the frontend (genquery/v1).
"""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


# ─── Connection ───────────────────────────────────────────────
class ConnectionConfig(BaseModel):
    host: str
    port: int = 5432
    database: str
    username: str
    password: str


class ConnectionResult(BaseModel):
    ok: bool
    error: Optional[str] = None
    connection_id: Optional[str] = None


# ─── MPP ──────────────────────────────────────────────────────
class DistributedBy(BaseModel):
    type: Literal["hash", "replicated", "randomly"] = "randomly"
    columns: list[str] = Field(default_factory=list)


class MPPConfig(BaseModel):
    distributedBy: DistributedBy = Field(default_factory=DistributedBy)
    optimizer: Literal["gporca", "legacy"] = "gporca"
    resourceQueue: str = "pg_default"
    statementMemory: str = ""
    parallelism: Optional[int] = None
    appendOnly: bool = False
    orientation: Literal["row", "column"] = "row"
    compressType: Literal["none", "ZLIB", "ZSTD", "QUICKLZ", "RLE_TYPE"] = "none"
    compressLevel: int = 6


# ─── AST nodes ────────────────────────────────────────────────
class ColumnExprAST(BaseModel):
    expression: str
    alias: Optional[str] = None


class TableRefAST(BaseModel):
    model_config = {"populate_by_name": True}
    schema_name: Optional[str] = Field(None, alias="schema")
    name: str
    alias: Optional[str] = None


class JoinAST(BaseModel):
    type: Literal["INNER", "LEFT", "RIGHT", "FULL OUTER", "CROSS"]
    right: TableRefAST
    on: str


class ConditionAST(BaseModel):
    column: str
    operator: str
    value: Optional[str] = None
    logic: Optional[Literal["AND", "OR"]] = None


class SelectClause(BaseModel):
    distinct: bool = False
    columns: list[ColumnExprAST] = Field(default_factory=list)


class GroupByClause(BaseModel):
    columns: list[str] = Field(default_factory=list)
    aggregations: list[ColumnExprAST] = Field(default_factory=list)
    having: Optional[str] = None


class OrderByClause(BaseModel):
    expression: str
    direction: Literal["ASC", "DESC"] = "ASC"


class QueryAST(BaseModel):
    model_config = {"populate_by_name": True}

    schema_version: Literal["genquery/v1"] = Field(alias="$schema")
    type: Literal["SELECT"]
    mpp: MPPConfig
    select: SelectClause
    from_: Optional[TableRefAST] = Field(None, alias="from")
    joins: list[JoinAST] = Field(default_factory=list)
    where: Optional[list[ConditionAST]] = None
    groupBy: Optional[GroupByClause] = None
    orderBy: list[OrderByClause] = Field(default_factory=list)
    limit: Optional[int] = None


# ─── Query execution result ───────────────────────────────────
class ColumnInfo(BaseModel):
    name: str
    type: str


class QueryResult(BaseModel):
    columns: list[ColumnInfo]
    rows: list[list]
    row_count: int
    execution_time_ms: float
    generated_sql: str
