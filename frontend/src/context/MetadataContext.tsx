import { createContext, useCallback, useContext, useState } from 'react'
import type { ConnectionConfig, ColumnMeta, TableMeta } from '../types'
import * as api from '../services/metadataService'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

interface MetadataStore {
  schemas: string[]
  tables: Record<string, TableMeta[]>   // schema → tables
  columns: Record<string, ColumnMeta[]> // "schema.table" → columns
}

interface MetadataContextValue {
  connection: ConnectionConfig | null
  connectionId: string | null           // opaque session token from backend
  status: ConnectionStatus
  statusMessage: string
  store: MetadataStore
  loadingSchemas: boolean
  loadingTables: string | null
  loadingColumns: string | null

  connect: (cfg: ConnectionConfig) => Promise<boolean>
  disconnect: () => void
  loadSchemas: () => Promise<void>
  loadTables: (schema: string) => Promise<void>
  loadColumns: (schema: string, table: string) => Promise<ColumnMeta[]>
}

const MetadataContext = createContext<MetadataContextValue>({
  connection: null,
  connectionId: null,
  status: 'idle',
  statusMessage: '',
  store: { schemas: [], tables: {}, columns: {} },
  loadingSchemas: false,
  loadingTables: null,
  loadingColumns: null,
  connect: async () => false,
  disconnect: () => {},
  loadSchemas: async () => {},
  loadTables: async () => {},
  loadColumns: async () => [],
})

export function MetadataProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<ConnectionConfig | null>(null)
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [store, setStore] = useState<MetadataStore>({ schemas: [], tables: {}, columns: {} })
  const [loadingSchemas, setLoadingSchemas] = useState(false)
  const [loadingTables, setLoadingTables] = useState<string | null>(null)
  const [loadingColumns, setLoadingColumns] = useState<string | null>(null)

  const connect = useCallback(async (cfg: ConnectionConfig): Promise<boolean> => {
    setStatus('connecting')
    setStatusMessage('Testando conexão…')

    // Quick connectivity check (no session stored)
    const testResult = await api.testConnection(cfg)
    if (!testResult.ok) {
      setStatus('error')
      setStatusMessage(testResult.error ?? 'Falha na conexão')
      return false
    }

    // Create session on the backend — receives the connection_id token
    const saveResult = await api.saveConnection(cfg)
    if (!saveResult.ok || !saveResult.connection_id) {
      setStatus('error')
      setStatusMessage(saveResult.error ?? 'Erro ao criar sessão')
      return false
    }

    setConnection(cfg)
    setConnectionId(saveResult.connection_id)
    setStatus('connected')
    setStatusMessage(`Conectado a ${cfg.database}@${cfg.host}`)
    setStore({ schemas: [], tables: {}, columns: {} })
    return true
  }, [])

  const disconnect = useCallback(() => {
    if (connectionId) {
      api.deleteConnection(connectionId).catch(() => { /* best-effort */ })
    }
    setConnection(null)
    setConnectionId(null)
    setStatus('idle')
    setStatusMessage('')
    setStore({ schemas: [], tables: {}, columns: {} })
  }, [connectionId])

  const loadSchemas = useCallback(async () => {
    if (status !== 'connected' || !connectionId) return
    setLoadingSchemas(true)
    try {
      const schemas = await api.fetchSchemas(connectionId)
      setStore(s => ({ ...s, schemas }))
    } finally {
      setLoadingSchemas(false)
    }
  }, [status, connectionId])

  const loadTables = useCallback(async (schema: string) => {
    if (status !== 'connected' || !connectionId) return
    if (store.tables[schema]) return
    setLoadingTables(schema)
    try {
      const tables = await api.fetchTables(schema, connectionId)
      setStore(s => ({ ...s, tables: { ...s.tables, [schema]: tables } }))
    } finally {
      setLoadingTables(null)
    }
  }, [status, connectionId, store.tables])

  const loadColumns = useCallback(async (schema: string, table: string): Promise<ColumnMeta[]> => {
    const key = `${schema}.${table}`
    if (store.columns[key]) return store.columns[key]
    if (status !== 'connected' || !connectionId) return []
    setLoadingColumns(key)
    try {
      const columns = await api.fetchColumns(schema, table, connectionId)
      setStore(s => ({ ...s, columns: { ...s.columns, [key]: columns } }))
      return columns
    } finally {
      setLoadingColumns(null)
    }
  }, [status, connectionId, store.columns])

  return (
    <MetadataContext.Provider value={{
      connection, connectionId, status, statusMessage, store,
      loadingSchemas, loadingTables, loadingColumns,
      connect, disconnect, loadSchemas, loadTables, loadColumns,
    }}>
      {children}
    </MetadataContext.Provider>
  )
}

export function useMetadata() {
  return useContext(MetadataContext)
}
