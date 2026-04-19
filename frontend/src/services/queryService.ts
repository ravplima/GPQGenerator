import type { QueryAST } from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

export interface ColumnInfo {
  name: string
  type: string
}

export interface QueryResult {
  columns: ColumnInfo[]
  rows: unknown[][]
  row_count: number
  execution_time_ms: number
  generated_sql: string
}

export async function executeQuery(
  ast: QueryAST,
  connectionId: string,
): Promise<QueryResult> {
  const res = await fetch(`${API_BASE}/api/query/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Connection-Id': connectionId,
    },
    body: JSON.stringify(ast),
  })

  if (!res.ok) {
    const body = await res.text()
    let detail = body
    try {
      const parsed = JSON.parse(body)
      detail = parsed?.detail ?? body
    } catch {
      // keep raw text
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }

  return res.json() as Promise<QueryResult>
}
