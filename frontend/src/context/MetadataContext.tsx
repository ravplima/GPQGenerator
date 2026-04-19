import { createContext, useCallback, useContext, useState } from 'react'
import type { ConnectionConfig, ColumnMeta, TableMeta } from '../types'
import * as api from '../services/metadataService'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

interface MetadataStore {
  schemas: string[]
  // schema → tables
  tables: Record<string, TableMeta[]>
  // "schema.table" → columns
  columns: Record<string, ColumnMeta[]>
}

interface MetadataContextValue {
  connection: ConnectionConfig | null
  status: ConnectionStatus
  statusMessage: string
  store: MetadataStore
  loadingSchemas: boolean
  loadingTables: string | null   // schema currently loading
  loadingColumns: string | null  // "schema.table" currently loading

  connect: (cfg: ConnectionConfig) => Promise<boolean>
  disconnect: () => void
  loadSchemas: () => Promise<void>
  loadTables: (schema: string) => Promise<void>
  loadColumns: (schema: string, table: string) => Promise<ColumnMeta[]>
}

const MetadataContext = createContext<MetadataContextValue>({
  connection: null,
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
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [store, setStore] = useState<MetadataStore>({ schemas: [], tables: {}, columns: {} })
  const [loadingSchemas, setLoadingSchemas] = useState(false)
  const [loadingTables, setLoadingTables] = useState<string | null>(null)
  const [loadingColumns, setLoadingColumns] = useState<string | null>(null)

  const connect = useCallback(async (cfg: ConnectionConfig): Promise<boolean> => {
    setStatus('connecting')
    setStatusMessage('Testando conexão…')
    const result = await api.testConnection(cfg)
    if (!result.ok) {
      setStatus('error')
      setStatusMessage(result.error ?? 'Falha na conexão')
      return false
    }
    await api.saveConnection(cfg)
    setConnection(cfg)
    setStatus('connected')
    setStatusMessage(`Conectado a ${cfg.database}@${cfg.host}`)
    setStore({ schemas: [], tables: {}, columns: {} })
    return true
  }, [])

  const disconnect = useCallback(() => {
    setConnection(null)
    setStatus('idle')
    setStatusMessage('')
    setStore({ schemas: [], tables: {}, columns: {} })
  }, [])

  const loadSchemas = useCallback(async () => {
    if (status !== 'connected') return
    setLoadingSchemas(true)
    try {
      const schemas = await api.fetchSchemas()
      setStore(s => ({ ...s, schemas }))
    } finally {
      setLoadingSchemas(false)
    }
  }, [status])

  const loadTables = useCallback(async (schema: string) => {
    if (status !== 'connected') return
    if (store.tables[schema]) return // already cached
    setLoadingTables(schema)
    try {
      const tables = await api.fetchTables(schema)
      setStore(s => ({ ...s, tables: { ...s.tables, [schema]: tables } }))
    } finally {
      setLoadingTables(null)
    }
  }, [status, store.tables])

  const loadColumns = useCallback(async (schema: string, table: string): Promise<ColumnMeta[]> => {
    const key = `${schema}.${table}`
    if (store.columns[key]) return store.columns[key]
    if (status !== 'connected') return []
    setLoadingColumns(key)
    try {
      const columns = await api.fetchColumns(schema, table)
      setStore(s => ({ ...s, columns: { ...s.columns, [key]: columns } }))
      return columns
    } finally {
      setLoadingColumns(null)
    }
  }, [status, store.columns])

  return (
    <MetadataContext.Provider value={{
      connection, status, statusMessage, store,
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
