# Contributing to GenQuery

GenQuery is a visual, drag-and-drop SQL builder for Greenplum / PostgreSQL. The user assembles a query by connecting nodes on a canvas; the result is a typed JSON AST that the Python backend translates into safe, parameterised SQL and executes.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [File Reference](#3-file-reference)
4. [Data Flow](#4-data-flow)
5. [Security Model](#5-security-model)
6. [Dependencies & Licences](#6-dependencies--licences)
7. [Known Vulnerabilities](#7-known-vulnerabilities)
8. [Running in Development](#8-running-in-development)
9. [Running in Production](#9-running-in-production)
10. [Environment Variables](#10-environment-variables)
11. [Known Limitations & Future Work](#11-known-limitations--future-work)
12. [Contribution Guidelines](#12-contribution-guidelines)

---

## 1. Project Overview

```
genquery/
├── frontend/   React + TypeScript + Vite  (canvas UI)
└── backend/    Python + FastAPI            (SQL execution API)
```

The frontend never constructs SQL strings. It produces a `genquery/v1` JSON AST that the backend receives, validates with Pydantic, and converts to SQL using `psycopg.sql.Identifier` — no string interpolation ever reaches the database.

---

## 2. Architecture

### 2.1 Frontend — Layered React Application

```
App.tsx  (canvas + state)
│
├── Context layer
│   ├── MPPContext          — Greenplum MPP config (optimizer, memory, distribution)
│   └── MetadataContext     — DB connection, schemas/tables/columns cache
│
├── Node layer  (ReactFlow custom nodes)
│   ├── TableNode           leaf: data source
│   ├── SelectNode          columns + DISTINCT
│   ├── JoinNode            join type + ON condition
│   ├── FilterNode          WHERE conditions
│   ├── GroupByNode         GROUP BY + aggregations + HAVING
│   ├── OrderByNode         ORDER BY + LIMIT
│   └── OutputNode          sink: AST viewer + query executor
│
├── Component layer
│   ├── Sidebar             drag source for node catalogue
│   ├── PropertiesPanel     contextual editor for selected node
│   │   └── properties/     one form component per node type
│   ├── DBConnectionPanel   database connection form
│   └── MPPPanel            Greenplum MPP settings form
│
├── Service layer  (HTTP)
│   ├── metadataService     /api/connection  /api/metadata/*
│   └── queryService        /api/query/execute
│
└── Util layer  (pure functions)
    ├── astGenerator        graph traversal → QueryAST
    └── upstreamColumns     BFS backwards → available columns for dropdowns
```

**Design pattern:** Pipeline. Data flows left → right through the node graph. `astGenerator.ts` materialises the pipeline into an AST by traversing edges backwards from the Output node.

### 2.2 Backend — Ports & Adapters

```
api/routes/      (HTTP adapters — know FastAPI, know nothing about SQL)
│   connection.py   session lifecycle
│   metadata.py     schema/table/column introspection
│   query.py        AST execution
│
api/deps.py      (shared FastAPI dependency — session extraction from header)
│
core/            (domain — knows nothing about FastAPI)
│   models.py    Pydantic: ConnectionConfig, QueryAST, QueryResult …
│   db.py        _Session, AsyncConnectionPool registry, open_cursor()
│   sql_builder.py  AST → psycopg.sql.Composable  (security-critical)
│
main.py          FastAPI app bootstrap, CORS, router registration
```

**Dependency rule:** `api/routes/*` imports `core/*`. `core/*` never imports from `api/`. This boundary makes `core/` independently testable without starting a server.

### 2.3 Session Model

The user supplies database credentials once. The backend validates them, opens an `AsyncConnectionPool`, and returns a UUID `connection_id`. The frontend sends `X-Connection-Id: <uuid>` on every subsequent request. The pool is closed when the user disconnects or the process restarts.

```
Browser ──POST /api/connection──────────────────► Backend
         { host, port, database, username, password }
                                                   └─ creates AsyncConnectionPool
                                                   └─ returns connection_id (UUID)

Browser ──GET /api/metadata/schemas──────────────► Backend
         X-Connection-Id: <uuid>
                                                   └─ borrows connection from pool
                                                   └─ returns [schema, ...]

Browser ──POST /api/query/execute────────────────► Backend
         X-Connection-Id: <uuid>
         Body: QueryAST (JSON)
                                                   └─ validates AST (Pydantic)
                                                   └─ builds SQL (sql_builder)
                                                   └─ executes (psycopg3 async)
                                                   └─ returns rows + metadata
```

---

## 3. File Reference

### 3.1 Frontend

| File | Responsibility |
|---|---|
| `src/types.ts` | Single source of truth for all TypeScript interfaces: node data types (`TableNodeData`, `SelectNodeData` …), `QueryAST` (mirrors backend Pydantic model), `ConnectionConfig`, `ColumnMeta`, `MPPConfig`, `NODE_CATALOG` |
| `src/main.tsx` | React DOM entry point — mounts `<App />` |
| `src/App.tsx` | Canvas orchestrator: `useNodesState`, `useEdgesState`, drag-and-drop handlers, toolbar (DB / MPP / Clear buttons), context providers |
| `src/index.css` | Dark-theme global styles. BEM-like class names: `.prop-group`, `.col-picker-*`, `.output-node`, `.result-table` |
| `src/vite-env.d.ts` | Declares `ImportMetaEnv` so `import.meta.env.VITE_API_URL` is typed |
| **Nodes** | |
| `src/nodes/TableNode.tsx` | Displays schema.table.alias; single output handle |
| `src/nodes/SelectNode.tsx` | Displays selected column count; input + output handles |
| `src/nodes/JoinNode.tsx` | Two input handles (left/right), one output; shows join type |
| `src/nodes/FilterNode.tsx` | Shows condition count; input + output handles |
| `src/nodes/GroupByNode.tsx` | Shows group columns + aggregation count; input + output |
| `src/nodes/OrderByNode.tsx` | Shows sort columns + limit; input + output |
| `src/nodes/OutputNode.tsx` | Graph sink. Calls `generateAST`, shows AST / SQL / Result tabs. Executes query via `queryService` |
| **Components** | |
| `src/components/Sidebar.tsx` | Renders `NODE_CATALOG` as draggable items; sets `dataTransfer` on drag start |
| `src/components/PropertiesPanel.tsx` | Reads selected node type; routes to the correct `properties/` sub-form |
| `src/components/properties/shared.tsx` | Reusable primitives: `Field`, `LoadingSelect`, `DisconnectedBadge`, `ColumnSelect`, `UpstreamColSelect` |
| `src/components/properties/TableProperties.tsx` | Schema → table → alias → column picker using live DB metadata |
| `src/components/properties/SelectProperties.tsx` | Column + alias rows; upstream-column dropdowns |
| `src/components/properties/JoinProperties.tsx` | Left-col / operator / right-col grid → builds `ON` condition string |
| `src/components/properties/FilterProperties.tsx` | Condition rows: column + operator + value + AND/OR logic |
| `src/components/properties/GroupByProperties.tsx` | Group-column checkboxes + aggregation rows + HAVING input |
| `src/components/properties/OrderByProperties.tsx` | Column + direction rows + LIMIT input |
| `src/components/DBConnectionPanel.tsx` | Floating panel; calls `connect()` / `disconnect()` from `MetadataContext` |
| `src/components/MPPPanel.tsx` | Floating panel; Distribution, Execution, Storage sections for Greenplum |
| **Context** | |
| `src/context/MPPContext.tsx` | `MPPConfig` state shared between `App` and `OutputNode` |
| `src/context/MetadataContext.tsx` | Connection lifecycle (`connect`, `disconnect`); lazy schema/table/column cache; exposes `status`, `store`, loading states |
| **Services** | |
| `src/services/metadataService.ts` | `apiFetch` helper (injects `X-Connection-Id`). Functions: `testConnection`, `saveConnection`, `deleteConnection`, `fetchSchemas`, `fetchTables`, `fetchColumns` |
| `src/services/queryService.ts` | `executeQuery(ast, connectionId)` — POST to `/api/query/execute` |
| **Utils** | |
| `src/utils/astGenerator.ts` | Entry point: `generateAST(nodes, edges, outputId, mpp) → QueryAST \| null`. Traverses the ReactFlow graph backwards from Output, accumulates `ASTState` per node type |
| `src/utils/upstreamColumns.ts` | `getUpstreamColumns(nodeId, nodes, edges) → string[]`. BFS backwards through edges; collects `alias.column` strings from ancestor Table nodes |

### 3.2 Backend

| File | Responsibility |
|---|---|
| `main.py` | FastAPI app; CORS (reads `ALLOWED_ORIGINS` env); registers three routers; `/health` endpoint |
| `requirements.txt` | Pinned minimum versions: fastapi, uvicorn[standard], psycopg[binary], psycopg-pool, pydantic, python-multipart |
| `core/models.py` | Pydantic v2 models. `ConnectionConfig`, `ConnectionResult`, `MPPConfig`, `QueryAST` (alias `$schema`→`schema_version`, `from`→`from_`), `SelectClause`, `GroupByClause`, `OrderByClause`, `JoinAST`, `ConditionAST`, `TableRefAST`, `QueryResult`, `ColumnInfo` |
| `core/db.py` | `_Session` dataclass: owns an `AsyncConnectionPool` (min=1 max=5, created lazily, closed on disconnect). `create_session`, `get_session`, `remove_session` (async — closes pool). `open_cursor()` async context manager: borrows from pool, yields `(conn, cursor)` |
| `core/sql_builder.py` | **Security-critical.** Converts `QueryAST` → `(psycopg.sql.Composable, list[params])`. Every identifier goes through `sql.Identifier()`. Every value goes through `%s` binding. Operators / functions / join types checked against `frozenset` whitelists. Expressions validated by strict regexes (`FUNC_EXPR_RE`, `ON_RE`, `HAVING_RE`) |
| `api/deps.py` | `require_connection(x_connection_id: str = Header(...))` — FastAPI dependency; raises 401 if session unknown |
| `api/routes/connection.py` | `POST /api/connection/test` (validate only), `POST /api/connection` (validate + persist, returns UUID), `DELETE /api/connection` (closes pool + removes session) |
| `api/routes/metadata.py` | `GET /api/metadata/schemas`, `/tables?schema=`, `/columns?schema=&table=`. Queries `information_schema` with `%s` parameters only |
| `api/routes/query.py` | `POST /api/query/execute`. Builds SQL → applies MPP SET commands → executes with params → resolves OID type names via `conn.adapters.types` → returns `QueryResult` |

---

## 4. Data Flow

### 4.1 AST Generation (frontend, pure)

```
Output node
  └─ generateAST(nodes, edges, outputId, mppConfig)
       └─ walks edges backwards from Output
            TableNode    → sets from_, alias, columns
            JoinNode     → appends to joins[]
            SelectNode   → sets select.columns
            FilterNode   → sets where[]
            GroupByNode  → sets groupBy
            OrderByNode  → sets orderBy, limit
       └─ returns QueryAST | null
```

### 4.2 Query Execution (frontend → backend)

```
OutputNode clicks ▶ Executar
  → queryService.executeQuery(ast, connectionId)
      POST /api/query/execute
      Headers: { X-Connection-Id, Content-Type: application/json }
      Body: QueryAST JSON

backend:
  1. Pydantic validates QueryAST
  2. sql_builder.build_sql(ast) → (Composable, params)
  3. mpp_set_commands(ast.mpp)  → SET optimizer / statement_mem
  4. pool.connection() → cur.execute(composable, params)
  5. resolve column OIDs → type names
  6. return { columns, rows, row_count, execution_time_ms, generated_sql }
```

### 4.3 Column Discovery (frontend, pure)

```
PropertiesPanel selects node X
  → getUpstreamColumns(nodeId, nodes, edges)
       BFS backwards through edges
       collect all ancestor TableNode columns as "alias.column"
  → passed to UpstreamColSelect dropdowns in property forms
```

---

## 5. Security Model

### SQL Injection Prevention

`sql_builder.py` uses three mechanisms, applied in layers:

| Layer | Mechanism | Applies to |
|---|---|---|
| Identifiers | `psycopg.sql.Identifier(name)` — unconditional quoting + escaping | schema, table, column, alias names |
| Values | `%s` parameterised binding | filter values, LIMIT, HAVING values |
| Structural keywords | `frozenset` whitelist checked before `sql.SQL(literal)` | operators, join types, sort directions |
| Expressions | Strict regex (`FUNC_EXPR_RE`, `ON_RE`, `HAVING_RE`) before parsing | aggregations, ON conditions, HAVING clauses |
| Identifiers (pre-check) | `IDENT_RE = r"^[A-Za-z_][A-Za-z0-9_]*$"` — rejects before quoting | all names |

**No identifier is ever string-interpolated into a query.**

### Authentication

- Credentials are accepted once, used to open an `AsyncConnectionPool`, then held in memory for the session lifetime.
- The `connection_id` UUID is an opaque session token — it contains no credentials.
- Sessions are strictly isolated: each session has its own pool with its own credentials.
- Credential scope is limited to the PostgreSQL role the user supplies.

### CORS

Controlled via `ALLOWED_ORIGINS` environment variable. When set to a specific origin list, `allow_credentials` is enabled; when `*` (dev default), credentials are disabled per CORS spec.

---

## 6. Dependencies & Licences

All direct dependencies are open source. None impose copyleft on application code (LGPL-3.0 on psycopg/psycopg-pool is satisfied by dynamic linking, which is the standard usage).

### Frontend (direct dependencies)

| Package | Version | Licence | Type | Source |
|---|---|---|---|---|
| `@xyflow/react` | 12.x | MIT | prod | https://github.com/xyflow/xyflow |
| `react` | 18.x | MIT | prod | https://github.com/facebook/react |
| `react-dom` | 18.x | MIT | prod | https://github.com/facebook/react |
| `uuid` | 9.x | MIT | prod | https://github.com/uuidjs/uuid |
| `vite` | 5.x | MIT | dev | https://github.com/vitejs/vite |
| `@vitejs/plugin-react` | 4.x | MIT | dev | https://github.com/vitejs/vite-plugin-react |
| `typescript` | 5.x | Apache-2.0 | dev | https://github.com/microsoft/TypeScript |
| `@types/react` | 18.x | MIT | dev | https://github.com/DefinitelyTyped/DefinitelyTyped |
| `@types/react-dom` | 18.x | MIT | dev | https://github.com/DefinitelyTyped/DefinitelyTyped |
| `@types/uuid` | 9.x | MIT | dev | https://github.com/DefinitelyTyped/DefinitelyTyped |

### Backend (direct dependencies)

| Package | Version | Licence | Source |
|---|---|---|---|
| `fastapi` | ≥0.111 | MIT | https://github.com/fastapi/fastapi |
| `uvicorn[standard]` | ≥0.30 | BSD-3-Clause | https://github.com/encode/uvicorn |
| `psycopg[binary]` | ≥3.1 | LGPL-3.0 | https://github.com/psycopg/psycopg |
| `psycopg-pool` | ≥3.2 | LGPL-3.0 | https://github.com/psycopg/psycopg |
| `pydantic` | ≥2.7 | MIT | https://github.com/pydantic/pydantic |
| `python-multipart` | ≥0.0.9 | Apache-2.0 | https://github.com/Kludex/python-multipart |

---

## 7. Known Vulnerabilities

### Frontend

| ID | Package | Severity | Exploitable in prod? | Notes |
|---|---|---|---|---|
| GHSA-67mh-4wv8-2f99 | `esbuild` ≤0.24.2 | Moderate | **No** | Affects dev server only; not present in production build. Transitive dev dependency of vite. |
| GHSA-4w7w-66w2-5vf9 | `vite` ≤6.4.1 | Moderate | **No** | Path traversal in optimised deps `.map` handling; only affects `vite dev` server. Fixed in vite 6.4.2+; a vite 5.x patch is not yet released upstream. |

**Production impact:** Zero. The production deployment serves a pre-built static bundle — neither `vite` nor `esbuild` are present in the production environment. Both vulnerabilities require a running development server to be exploitable.

**Mitigation during development:** Do not expose the Vite dev server (`localhost:5173`) to untrusted networks. Run it only on `localhost`.

### Backend

All application packages (`fastapi`, `uvicorn`, `psycopg`, `psycopg-pool`, `pydantic`, `python-multipart`) have **no known vulnerabilities** as of the date of this document. The `pip` tool itself has two CVEs (CVE-2025-8869, CVE-2026-1703) affecting tar/wheel extraction; these are not relevant to runtime operation.

Run `pip-audit` periodically to re-check:

```bash
cd backend && .venv/bin/pip-audit
```

---

## 8. Running in Development

### Prerequisites

- Python ≥ 3.11
- Node.js ≥ 18
- A running PostgreSQL or Greenplum instance

### Backend

```bash
cd backend

# Create virtual environment (first time only)
python3 -m venv .venv

# Install dependencies
.venv/bin/pip install -r requirements.txt

# Start the API server (auto-reload)
.venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

The API will be available at `http://localhost:8001`.
Interactive docs: `http://localhost:8001/docs`.

### Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start the dev server
npm run dev
```

The UI will be available at `http://localhost:5173`.

By default the frontend calls `http://localhost:8001`. Override with:

```bash
VITE_API_URL=http://my-backend:8001 npm run dev
```

---

## 9. Running in Production

### Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

ALLOWED_ORIGINS=https://your-frontend.example.com \
  .venv/bin/uvicorn main:app \
    --host 0.0.0.0 \
    --port 8001 \
    --workers 4 \
    --proxy-headers \
    --forwarded-allow-ips='*'
```

For process supervision use `systemd` or a container. Example `systemd` unit:

```ini
[Unit]
Description=GenQuery Backend
After=network.target

[Service]
User=genquery
WorkingDirectory=/opt/genquery/backend
Environment=ALLOWED_ORIGINS=https://app.example.com
ExecStart=/opt/genquery/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

### Frontend

```bash
cd frontend
VITE_API_URL=https://api.example.com npm run build
# Outputs to frontend/dist/
```

Serve `frontend/dist/` with any static file server (nginx, Caddy, S3+CloudFront). Example nginx block:

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;

    root /opt/genquery/frontend/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 10. Environment Variables

### Backend

| Variable | Default | Description |
|---|---|---|
| `ALLOWED_ORIGINS` | `*` | Comma-separated list of allowed CORS origins. Use `*` only in development. Example: `https://app.example.com,https://admin.example.com` |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8001` | Base URL of the backend API. Set at build time (`npm run build`). |

---

## 11. Known Limitations & Future Work

These are deliberate trade-offs in the current implementation. Each item below describes the limitation, its impact, and a recommended implementation path.

### 11.1 Sessions in Memory (`core/db.py: _sessions`)

**Impact:** If the backend process restarts (deploy, crash, OOM kill), all active sessions are lost. Users must reconnect.

**Recommended fix:** Store session metadata (credentials encrypted with a server-side key, or just the connection_id mapping to a credential store) in Redis or PostgreSQL itself. Replace the `_sessions: dict` with a Redis client call.

```python
# Sketch
import redis.asyncio as redis

async def get_session(connection_id: str) -> _Session:
    raw = await redis_client.get(f"session:{connection_id}")
    if not raw:
        raise KeyError(...)
    config = ConnectionConfig.model_validate_json(raw)
    return _Session(connection_id=connection_id, config=config)
```

### 11.2 No Row Streaming (`query.py: MAX_ROWS = 10_000`)

**Impact:** `fetchmany(10_000)` loads the entire result into Python memory before sending the response. A query returning 10 000 wide rows (e.g. many TEXT columns) can consume significant memory.

**Recommended fix:** Stream rows using Server-Sent Events (SSE) or chunked JSON:

```python
from fastapi.responses import StreamingResponse

async def stream_rows(cur):
    async for row in cur:
        yield json.dumps([_serialize(v) for v in row.values()]) + "\n"

return StreamingResponse(stream_rows(cur), media_type="application/x-ndjson")
```

The frontend `OutputNode` would need to consume NDJSON incrementally.

### 11.3 Single Query Type

**Impact:** Only `SELECT` queries are supported. `INSERT`, `UPDATE`, `DELETE`, `EXPLAIN`, `EXPLAIN ANALYZE`, and DDL are not representable in the AST.

**Recommended fix:** Add a `type` discriminator to `QueryAST` and implement separate builders in `sql_builder.py` for each statement type. The frontend node graph would need a way to express DML targets.

### 11.4 No Authentication Layer

**Impact:** Any client that can reach the backend API can attempt to start a session by supplying database credentials. There is no user identity, no role-based access control, and no rate limiting.

**Recommended fix:**
- Add an authentication middleware (JWT or session cookie) in front of all `/api/*` routes.
- Add rate limiting on `/api/connection` to prevent credential-stuffing against the database.
- Consider integrating with an identity provider (OIDC).

### 11.5 No Query Timeout

**Impact:** A long-running query blocks the connection for its entire duration. If Greenplum is under load, this can exhaust the pool for that session.

**Recommended fix:** Set `statement_timeout` (PostgreSQL) or use psycopg3's `AsyncCursor` with `query_timeout`:

```python
await cur.execute("SET statement_timeout = '30s'")
```

Or pass it as a connect parameter: `options="-c statement_timeout=30000"`.

### 11.6 No Persistent Query History

**Impact:** Executed queries and their results are not saved anywhere. Users cannot review past queries or share them.

**Recommended fix:** Persist `QueryAST + QueryResult` metadata to a backend database, keyed by a short ID. Expose `GET /api/history/:id` to retrieve past results.

### 11.7 Vite / esbuild Dev-Server Vulnerabilities

**Impact:** Development only. See [Section 7](#7-known-vulnerabilities).

**Recommended fix:** Update vite once a 5.x patch is released upstream, or migrate to vite 6.x (requires checking for breaking changes in the `@vitejs/plugin-react` integration).

```bash
cd frontend && npm update vite @vitejs/plugin-react
npm audit
```

---

## 12. Contribution Guidelines

### Branch Strategy

```
main         — production-ready, protected
feature/*    — new features (branch from main, PR back to main)
fix/*        — bug fixes
```

### Adding a New Node Type

1. **Define the data type** in `src/types.ts` — add a `XxxNodeData` interface and add it to `AppNode` union and `NODE_CATALOG`.
2. **Create the visual node** in `src/nodes/XxxNode.tsx` — use `Handle` components from `@xyflow/react`.
3. **Create the property form** in `src/components/properties/XxxProperties.tsx` — import shared helpers from `./shared`.
4. **Register the form** in `src/components/PropertiesPanel.tsx` — add a `nodeType === 'xxx'` branch.
5. **Add default data** in `App.tsx` `defaultData()` switch.
6. **Handle the node in AST generation** in `src/utils/astGenerator.ts`.
7. **Extend the backend model** in `core/models.py` if the new node type requires new AST fields.
8. **Extend `sql_builder.py`** to handle the new AST field — always use `sql.Identifier()` for identifiers and `%s` for values.

### Modifying the SQL Builder

`core/sql_builder.py` is security-critical. Follow these rules:

- **Never** use Python f-strings or `%` string formatting to build SQL fragments.
- **Always** use `sql.Identifier()` for any name that comes from user input.
- **Always** use `%s` parameters for any value that comes from user input.
- **Always** add new operators/functions to the appropriate `frozenset` whitelist.
- **Always** write a regex test for any new expression pattern before accepting it.

### Running Tests

There are no automated tests in the current codebase — adding them is a priority contribution. Recommended test setup:

**Backend (pytest + pytest-asyncio):**

```bash
cd backend
.venv/bin/pip install pytest pytest-asyncio httpx
.venv/bin/pytest tests/
```

Key areas to cover:
- `core/sql_builder.py` — valid ASTs produce correct SQL; injection attempts raise `ValueError`
- `api/routes/` — HTTP contract tests using `httpx.AsyncClient`

**Frontend (Vitest):**

```bash
cd frontend
npm install -D vitest @testing-library/react
npx vitest
```

Key areas to cover:
- `utils/astGenerator.ts` — graph traversal produces correct AST
- `utils/upstreamColumns.ts` — BFS returns correct column list

### Code Style

- **Backend:** Black formatter, `isort` imports. No type: ignore without a comment explaining why.
- **Frontend:** No Prettier config currently — follow the existing 2-space indent, single quotes.
- **Comments:** Only when the *why* is non-obvious. No docstrings narrating what the code already says.

### Security Review Checklist (for PRs touching sql_builder.py or routes)

- [ ] Does any new code interpolate user input into a SQL string?
- [ ] Are all new identifiers wrapped in `sql.Identifier()`?
- [ ] Are all new values passed as `%s` parameters?
- [ ] Are all new keywords/operators checked against a whitelist?
- [ ] Does the Pydantic model validate the shape before `build_sql` is called?
