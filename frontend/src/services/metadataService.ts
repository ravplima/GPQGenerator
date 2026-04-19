import type { ConnectionConfig, ColumnMeta, TableMeta } from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function testConnection(config: ConnectionConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    return await apiFetch('/api/connection/test', {
      method: 'POST',
      body: JSON.stringify(config),
    })
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function saveConnection(config: ConnectionConfig): Promise<void> {
  await apiFetch('/api/connection', { method: 'POST', body: JSON.stringify(config) })
}

export async function fetchSchemas(): Promise<string[]> {
  return apiFetch('/api/metadata/schemas')
}

export async function fetchTables(schema: string): Promise<TableMeta[]> {
  return apiFetch(`/api/metadata/tables?schema=${encodeURIComponent(schema)}`)
}

export async function fetchColumns(schema: string, table: string): Promise<ColumnMeta[]> {
  return apiFetch(
    `/api/metadata/columns?schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(table)}`,
  )
}
