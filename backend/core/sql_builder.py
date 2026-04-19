"""
Safe AST → SQL builder.

Security model
──────────────
• Every identifier (schema, table, column, alias) passes through
  psycopg2.sql.Identifier(), which quotes and escapes it unconditionally.
  Before that, each name is validated against IDENT_RE so we reject names
  that would confuse the parser even if properly quoted.

• Every user-supplied *value* (filter operands, LIMIT) is passed as a
  psycopg2 parameter (%s), never interpolated into the query string.

• Operators, join types, functions, and sort directions are checked against
  explicit frozensets before being written as sql.SQL() literals.

• Expression strings (aggregations, ORDER BY terms) are parsed by a strict
  regex that only allows the patterns the frontend actually emits; anything
  outside that grammar is rejected with a ValueError.
"""
from __future__ import annotations

import re
from typing import Any

from psycopg.sql import SQL, Identifier, Composed, Placeholder
from psycopg import sql

from .models import (
    QueryAST, ColumnExprAST, TableRefAST,
    JoinAST, ConditionAST, OrderByClause, MPPConfig,
)

# ─── Whitelists ───────────────────────────────────────────────

IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

# schema.table, alias.column, schema.table.column — up to 3 parts
QUALIFIED_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*){0,2}$")

ALLOWED_FUNCTIONS: frozenset[str] = frozenset({
    "COUNT", "SUM", "AVG", "MIN", "MAX",
    "COALESCE", "NULLIF", "UPPER", "LOWER", "TRIM",
    "LENGTH", "ABS", "ROUND", "CEIL", "FLOOR",
    "DATE_TRUNC", "EXTRACT", "TO_CHAR", "TO_DATE",
    "NOW", "CURRENT_DATE", "CURRENT_TIMESTAMP",
})

ALLOWED_OPERATORS: frozenset[str] = frozenset({
    "=", "!=", "<>", ">", "<", ">=", "<=",
    "LIKE", "NOT LIKE", "ILIKE", "NOT ILIKE",
    "IN", "NOT IN", "IS NULL", "IS NOT NULL",
})

ALLOWED_JOIN_TYPES: frozenset[str] = frozenset({
    "INNER", "LEFT", "RIGHT", "FULL OUTER", "CROSS",
})

MEMORY_RE = re.compile(r"^\d+\s*(KB|MB|GB)$", re.IGNORECASE)

# Matches FUNC(col), FUNC(DISTINCT col), FUNC(*) produced by the frontend
FUNC_EXPR_RE = re.compile(
    r"^(?P<func>[A-Za-z_][A-Za-z0-9_]*)\s*"
    r"\(\s*(?P<distinct>DISTINCT\s+)?"
    r"(?P<col>[A-Za-z_][A-Za-z0-9_.]*|\*)\s*\)$",
    re.IGNORECASE,
)

# Matches simple ON conditions:  alias.col = alias.col
ON_RE = re.compile(
    r"^(?P<left>[A-Za-z_][A-Za-z0-9_.]*)\s*"
    r"(?P<op>=|!=|<>|>=?|<=?)\s*"
    r"(?P<right>[A-Za-z_][A-Za-z0-9_.]*)$"
)

# Matches HAVING patterns the frontend produces:
# COUNT(*) > 10  |  SUM(col) > 100.5  |  AVG(alias.col) <= 50
HAVING_RE = re.compile(
    r"^(?P<agg>(?:COUNT\(\*\)|(?:[A-Za-z_]+)\([A-Za-z_][A-Za-z0-9_.]*\)))"
    r"\s*(?P<op>=|!=|<>|>=?|<=?)\s*"
    r"(?P<val>-?\d+(?:\.\d+)?)$",
    re.IGNORECASE,
)


# ─── Low-level helpers ────────────────────────────────────────

def _check_ident(name: str) -> str:
    if not IDENT_RE.match(name):
        raise ValueError(f"Identificador inválido: {name!r}")
    return name


def _ident(name: str) -> sql.Identifier:
    return sql.Identifier(_check_ident(name))


def _qualified(dotted: str) -> sql.Composable:
    """'schema.table' or 'alias.col'  →  "schema"."table" """
    if not QUALIFIED_RE.match(dotted):
        raise ValueError(f"Identificador qualificado inválido: {dotted!r}")
    parts = dotted.split(".")
    return sql.SQL(".").join(sql.Identifier(p) for p in parts)


# ─── Expression parser ────────────────────────────────────────

def _expr(raw: str) -> sql.Composable:
    """
    Convert an expression string to a sql.Composable.
    Accepts:  alias.col | col | FUNC(col) | FUNC(DISTINCT col) | FUNC(*) | *
    Rejects:  anything else.
    """
    raw = raw.strip()

    if raw == "*":
        return sql.SQL("*")

    # Function call
    m = FUNC_EXPR_RE.match(raw)
    if m:
        func = m.group("func").upper()
        if func not in ALLOWED_FUNCTIONS:
            raise ValueError(f"Função não permitida: {func!r}")
        col_raw = m.group("col")
        col_part = sql.SQL("*") if col_raw == "*" else _qualified(col_raw)
        if m.group("distinct"):
            return sql.SQL("{f}(DISTINCT {c})").format(f=sql.SQL(func), c=col_part)
        return sql.SQL("{f}({c})").format(f=sql.SQL(func), c=col_part)

    # Qualified or simple identifier
    if QUALIFIED_RE.match(raw):
        return _qualified(raw)

    raise ValueError(f"Expressão não permitida: {raw!r}")


# ─── Clause builders ─────────────────────────────────────────

def _build_table_ref(ref: TableRefAST) -> sql.Composable:
    parts: list[sql.Composable] = []
    if ref.schema_name:
        parts.append(_ident(ref.schema_name))
        parts.append(sql.SQL("."))
    parts.append(_ident(ref.name))
    if ref.alias:
        parts.append(sql.SQL(" AS "))
        parts.append(_ident(ref.alias))
    return sql.Composed(parts)


def _build_select_col(col: ColumnExprAST) -> sql.Composable:
    e = _expr(col.expression)
    if col.alias:
        return sql.SQL("{e} AS {a}").format(e=e, a=_ident(col.alias))
    return e


def _build_condition(cond: ConditionAST, params: list[Any]) -> sql.Composable:
    op = cond.operator.upper().strip()
    if op not in ALLOWED_OPERATORS:
        raise ValueError(f"Operador não permitido: {op!r}")

    col_sql = _expr(cond.column)

    if op in ("IS NULL", "IS NOT NULL"):
        return sql.SQL("{c} {op}").format(c=col_sql, op=sql.SQL(op))

    if op in ("IN", "NOT IN"):
        values = [v.strip() for v in (cond.value or "").split(",") if v.strip()]
        if not values:
            raise ValueError("Cláusula IN requer ao menos um valor")
        placeholders = sql.SQL(", ").join(sql.SQL("%s") for _ in values)
        params.extend(values)
        return sql.SQL("{c} {op} ({ph})").format(
            c=col_sql, op=sql.SQL(op), ph=placeholders
        )

    params.append(cond.value)
    return sql.SQL("{c} {op} %s").format(c=col_sql, op=sql.SQL(op))


def _build_on(on: str, params: list[Any]) -> sql.Composable:
    m = ON_RE.match(on.strip())
    if not m:
        raise ValueError(
            f"Condição ON inválida. Use o formato 'alias.col OPERADOR alias.col'. Recebido: {on!r}"
        )
    return sql.SQL("{l} {op} {r}").format(
        l=_qualified(m.group("left")),
        op=sql.SQL(m.group("op")),
        r=_qualified(m.group("right")),
    )


def _build_having(having: str, params: list[Any]) -> sql.Composable:
    m = HAVING_RE.match(having.strip())
    if not m:
        raise ValueError(
            f"HAVING inválido. Use o formato 'FUNC(col) OPERADOR número'. Recebido: {having!r}"
        )
    agg_sql = _expr(m.group("agg"))
    op = m.group("op")
    val_str = m.group("val")
    val = float(val_str) if "." in val_str else int(val_str)
    params.append(val)
    return sql.SQL("{a} {op} %s").format(a=agg_sql, op=sql.SQL(op))


# ─── MPP SET commands ────────────────────────────────────────

def mpp_set_commands(mpp: MPPConfig) -> list[str]:
    """
    Returns a list of SET statements to run before the main query.
    Each command is a plain string — safe to execute because values are
    taken from a validated Pydantic model, not from raw user input.
    """
    cmds: list[str] = []

    # Optimizer: gporca (on) or legacy planner (off)
    cmds.append("SET optimizer = 'on'" if mpp.optimizer == "gporca" else "SET optimizer = 'off'")

    # statement_mem — only if it matches the expected format
    if mpp.statementMemory and MEMORY_RE.match(mpp.statementMemory):
        cmds.append(f"SET statement_mem = '{mpp.statementMemory}'")

    return cmds


# ─── Main entry point ────────────────────────────────────────

def build_sql(ast: QueryAST) -> tuple[sql.Composable, list[Any]]:
    """
    Converts a validated QueryAST into a (composable, params) pair.

    The composable is passed directly to cursor.execute(); it contains
    %s placeholders for the values in `params`.
    """
    params: list[Any] = []
    clauses: list[sql.Composable] = []

    # ── SELECT ────────────────────────────────────────────────
    distinct_kw = sql.SQL("DISTINCT ") if ast.select.distinct else sql.SQL("")
    if not ast.select.columns:
        raise ValueError("SELECT requer ao menos uma coluna")
    cols_sql = sql.SQL(", ").join(_build_select_col(c) for c in ast.select.columns)
    clauses.append(sql.SQL("SELECT {d}{cols}").format(d=distinct_kw, cols=cols_sql))

    # ── FROM ──────────────────────────────────────────────────
    if ast.from_ is None:
        raise ValueError("FROM é obrigatório")
    clauses.append(sql.SQL("FROM {t}").format(t=_build_table_ref(ast.from_)))

    # ── JOINs ─────────────────────────────────────────────────
    for join in ast.joins:
        jtype = join.type.upper()
        if jtype not in ALLOWED_JOIN_TYPES:
            raise ValueError(f"Tipo de join não permitido: {jtype!r}")
        on_sql = _build_on(join.on, params)
        clauses.append(
            sql.SQL("{jt} JOIN {ref} ON {on}").format(
                jt=sql.SQL(jtype),
                ref=_build_table_ref(join.right),
                on=on_sql,
            )
        )

    # ── WHERE ─────────────────────────────────────────────────
    if ast.where:
        cond_parts: list[sql.Composable] = []
        for i, cond in enumerate(ast.where):
            built = _build_condition(cond, params)
            if i > 0:
                logic = (cond.logic or "AND").upper()
                if logic not in ("AND", "OR"):
                    raise ValueError(f"Lógica inválida: {logic!r}")
                built = sql.SQL("{l} {c}").format(l=sql.SQL(logic), c=built)
            cond_parts.append(built)
        clauses.append(
            sql.SQL("WHERE {c}").format(c=sql.SQL(" ").join(cond_parts))
        )

    # ── GROUP BY ──────────────────────────────────────────────
    if ast.groupBy and (ast.groupBy.columns or ast.groupBy.aggregations):
        grp_cols = sql.SQL(", ").join(_qualified(c) for c in ast.groupBy.columns)
        clauses.append(sql.SQL("GROUP BY {c}").format(c=grp_cols))
        if ast.groupBy.having:
            clauses.append(
                sql.SQL("HAVING {h}").format(
                    h=_build_having(ast.groupBy.having, params)
                )
            )

    # ── ORDER BY ──────────────────────────────────────────────
    if ast.orderBy:
        order_parts: list[sql.Composable] = []
        for ob in ast.orderBy:
            direction = ob.direction.upper()
            if direction not in ("ASC", "DESC"):
                raise ValueError(f"Direction inválida: {direction!r}")
            order_parts.append(
                sql.SQL("{e} {d}").format(e=_expr(ob.expression), d=sql.SQL(direction))
            )
        clauses.append(
            sql.SQL("ORDER BY {o}").format(o=sql.SQL(", ").join(order_parts))
        )

    # ── LIMIT ─────────────────────────────────────────────────
    if ast.limit is not None:
        if not isinstance(ast.limit, int) or ast.limit < 1:
            raise ValueError(f"LIMIT deve ser um inteiro positivo, recebido: {ast.limit!r}")
        clauses.append(sql.SQL("LIMIT %s"))
        params.append(ast.limit)

    return sql.SQL("\n").join(clauses), params
