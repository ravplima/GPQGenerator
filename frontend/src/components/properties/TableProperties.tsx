import { useEffect } from 'react'
import type { TableNodeData, ColumnMeta, TableMeta } from '../../types'
import { useMetadata } from '../../context/MetadataContext'
import { Field, LoadingSelect, DisconnectedBadge } from './shared'

export function TableProperties({
  data,
  onUpdate,
}: {
  data: TableNodeData
  onUpdate: (d: Partial<TableNodeData>) => void
}) {
  const { status, store, loadSchemas, loadTables, loadColumns, loadingTables, loadingColumns } = useMetadata()
  const isConnected = status === 'connected'

  const tableKey = data.schema && data.tableName ? `${data.schema}.${data.tableName}` : null
  const availableCols: ColumnMeta[] = tableKey ? (store.columns[tableKey] ?? []) : []
  const selectedCols: Set<string> = new Set(data.columns ?? [])

  useEffect(() => {
    if (isConnected && store.schemas.length === 0) loadSchemas()
  }, [isConnected, store.schemas.length, loadSchemas])

  useEffect(() => {
    if (isConnected && data.schema) loadTables(data.schema)
  }, [isConnected, data.schema, loadTables])

  useEffect(() => {
    if (isConnected && data.schema && data.tableName) {
      loadColumns(data.schema, data.tableName).then(cols => {
        if (!data.alias && data.tableName) {
          onUpdate({ alias: data.tableName.charAt(0).toLowerCase() })
        }
        if (cols.length > 0) {
          const valid = new Set(cols.map(c => c.name))
          const cleaned = (data.columns ?? []).filter(c => valid.has(c))
          if (cleaned.length !== (data.columns ?? []).length) onUpdate({ columns: cleaned })
        }
      })
    }
  }, [isConnected, data.schema, data.tableName]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isConnected) return <DisconnectedBadge />

  const tables: TableMeta[] = data.schema ? (store.tables[data.schema] ?? []) : []
  const loadingThisTable = loadingColumns === tableKey

  function toggleCol(name: string) {
    if (selectedCols.has(name)) {
      onUpdate({ columns: data.columns.filter(c => c !== name) })
    } else {
      onUpdate({ columns: [...(data.columns ?? []), name] })
    }
  }

  function toggleAll() {
    if (selectedCols.size === availableCols.length) {
      onUpdate({ columns: [] })
    } else {
      onUpdate({ columns: availableCols.map(c => c.name) })
    }
  }

  return (
    <div>
      <Field label="Schema">
        {store.schemas.length === 0 ? (
          <LoadingSelect placeholder="⏳ Carregando schemas…" />
        ) : (
          <select
            className="prop-select"
            value={data.schema || ''}
            onChange={e => onUpdate({ schema: e.target.value, tableName: '', columns: [] })}
          >
            <option value="">— selecione o schema —</option>
            {store.schemas.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </Field>

      {data.schema && (
        <Field label="Tabela">
          {loadingTables === data.schema ? (
            <LoadingSelect placeholder="⏳ Carregando tabelas…" />
          ) : (
            <select
              className="prop-select"
              value={data.tableName || ''}
              onChange={e => onUpdate({ tableName: e.target.value, columns: [] })}
            >
              <option value="">— selecione a tabela —</option>
              {tables.map(t => (
                <option key={t.name} value={t.name}>
                  {t.name} {t.tableType !== 'BASE TABLE' ? `(${t.tableType})` : ''}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      {data.tableName && (
        <Field label="Alias">
          <input
            className="prop-input"
            value={data.alias || ''}
            placeholder="t"
            maxLength={20}
            onChange={e => onUpdate({ alias: e.target.value })}
          />
        </Field>
      )}

      {data.tableName && (
        <Field label={`Colunas${availableCols.length > 0 ? ` (${selectedCols.size}/${availableCols.length})` : ''}`}>
          {loadingThisTable ? (
            <div className="meta-loading">⏳ Carregando colunas…</div>
          ) : availableCols.length === 0 ? (
            <div className="mpp-hint">Nenhuma coluna encontrada.</div>
          ) : (
            <>
              <div className="col-picker-toolbar">
                <button className="col-picker-all" onClick={toggleAll}>
                  {selectedCols.size === availableCols.length ? 'Desmarcar todas' : 'Selecionar todas'}
                </button>
                <span style={{ color: '#475569', fontSize: 11 }}>{selectedCols.size} selecionadas</span>
              </div>
              <div className="col-picker-list">
                {availableCols.map(col => (
                  <label key={col.name} className="col-picker-row">
                    <input
                      type="checkbox"
                      checked={selectedCols.has(col.name)}
                      onChange={() => toggleCol(col.name)}
                    />
                    <span className="col-picker-name">{col.name}</span>
                    <span className="col-picker-type">{col.dataType}</span>
                    {!col.nullable && <span className="col-picker-nn">NOT NULL</span>}
                  </label>
                ))}
              </div>
            </>
          )}
        </Field>
      )}
    </div>
  )
}
