import type { ConnectionConfig, ColumnMeta, TableMeta } from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

// ─── Authenticated fetch ──────────────────────────────────────
// All requests after connect include X-Connection-Id so the backend can
// look up the right session without storing credentials in the browser.

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  connectionId?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(connectionId ? { 'X-Connection-Id': connectionId } : {}),
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...((options?.headers as Record<string, string>) ?? {}) },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── Connection ───────────────────────────────────────────────

export async function testConnection(
  config: ConnectionConfig,
): Promise<{ ok: boolean; error?: string }> {
  try {
    return await apiFetch('/api/connection/test', {
      method: 'POST',
      body: JSON.stringify(config),
    })
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/** Sends credentials to the backend and returns the session connection_id. */
export async function saveConnection(
  config: ConnectionConfig,
): Promise<{ ok: boolean; connection_id?: string; error?: string }> {
  try {
    return await apiFetch('/api/connection', {
      method: 'POST',
      body: JSON.stringify(config),
    })
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function deleteConnection(connectionId: string): Promise<void> {
  await apiFetch('/api/connection', { method: 'DELETE' }, connectionId)
}

// ─── Metadata ─────────────────────────────────────────────────

export async function fetchSchemas(connectionId: string): Promise<string[]> {
  return apiFetch('/api/metadata/schemas', {}, connectionId)
}

export async function fetchTables(
  schema: string,
  connectionId: string,
): Promise<TableMeta[]> {
  return apiFetch(
    `/api/metadata/tables?schema=${encodeURIComponent(schema)}`,
    {},
    connectionId,
  )
}

export async function fetchColumns(
  schema: string,
  table: string,
  connectionId: string,
): Promise<ColumnMeta[]> {
  return apiFetch(
    `/api/metadata/columns?schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(table)}`,
    {},
    connectionId,
  )
}
