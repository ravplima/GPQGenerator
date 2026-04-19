import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Edge } from '@xyflow/react'
import type {
  AppNode,
  TableNodeData, SelectNodeData, JoinNodeData, FilterNodeData,
  GroupByNodeData, OrderByNodeData,
  Column, FilterCondition, Aggregation, OrderColumn,
  ColumnMeta, TableMeta,
} from '../types'
import { NODE_CATALOG } from '../types'
import { useMetadata } from '../context/MetadataContext'
import { getUpstreamColumns } from '../utils/upstreamColumns'

interface Props {
  node: AppNode | null
  nodes: AppNode[]
  edges: Edge[]
  onUpdate: (data: Record<string, unknown>) => void
}

// ─── Shared helpers ───────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="prop-group">
      <label className="prop-label">{label}</label>
      {children}
    </div>
  )
}

/** Spinner shown inside a select while loading */
function LoadingSelect({ placeholder }: { placeholder: string }) {
  return (
    <select className="prop-select" disabled>
      <option>{placeholder}</option>
    </select>
  )
}

function DisconnectedBadge() {
  return (
    <div className="meta-disconnected">
      🔌 Banco não conectado — configure a conexão para selecionar do catálogo
    </div>
  )
}

/** Renders a column picker from a list of ColumnMeta */
function ColumnSelect({
  value,
  columns,
  onChange,
  placeholder = '— selecione uma coluna —',
  style,
}: {
  value: string
  columns: ColumnMeta[]
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) {
  return (
    <select className="prop-select" value={value} onChange={e => onChange(e.target.value)} style={style}>
      <option value="">{placeholder}</option>
      {columns.map(c => (
        <option key={c.name} value={c.name}>
          {c.name} <span style={{ color: '#475569' }}>— {c.dataType}</span>
        </option>
      ))}
    </select>
  )
}

/** Upstream column picker (alias.col strings from connected Table nodes) */
function UpstreamColSelect({
  value,
  upstreamCols,
  onChange,
  placeholder = '— selecione —',
  style,
}: {
  value: string
  upstreamCols: string[]
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) {
  return (
    <select className="prop-select" value={value} onChange={e => onChange(e.target.value)} style={style}>
      <option value="">— selecione —</option>
      {upstreamCols.map(c => (
        <option key={c} value={c}>{c}</option>
      ))}
      {upstreamCols.length === 0 && (
        <option disabled>Nenhuma tabela conectada</option>
      )}
    </select>
  )
}

// ─── Table Properties ─────────────────────────────────────────
function TableProperties({ data, onUpdate }: { data: TableNodeData; onUpdate: (d: Partial<TableNodeData>) => void }) {
  const { status, store, loadSchemas, loadTables, loadColumns, loadingTables, loadingColumns } = useMetadata()
  const isConnected = status === 'connected'

  const tableKey = data.schema && data.tableName ? `${data.schema}.${data.tableName}` : null
  const availableCols: ColumnMeta[] = tableKey ? (store.columns[tableKey] ?? []) : []
  const selectedCols: Set<string> = new Set(data.columns ?? [])

  // Load schemas once connected
  useEffect(() => {
    if (isConnected && store.schemas.length === 0) loadSchemas()
  }, [isConnected, store.schemas.length, loadSchemas])

  // Load tables when schema changes
  useEffect(() => {
    if (isConnected && data.schema) loadTables(data.schema)
  }, [isConnected, data.schema, loadTables])

  // Auto-load columns when table selected
  useEffect(() => {
    if (isConnected && data.schema && data.tableName) {
      loadColumns(data.schema, data.tableName).then(cols => {
        // Auto-populate alias from table name if empty
        if (!data.alias && data.tableName) {
          onUpdate({ alias: data.tableName.charAt(0).toLowerCase() })
        }
        // Sync: remove columns that no longer exist in the DB
        if (cols.length > 0) {
          const valid = new Set(cols.map(c => c.name))
          const cleaned = (data.columns ?? []).filter(c => valid.has(c))
          if (cleaned.length !== (data.columns ?? []).length) onUpdate({ columns: cleaned })
        }
      })
    }
  }, [isConnected, data.schema, data.tableName]) // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!isConnected) return <DisconnectedBadge />

  const tables: TableMeta[] = data.schema ? (store.tables[data.schema] ?? []) : []
  const loadingThisTable = loadingColumns === tableKey

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

// ─── Select Properties ────────────────────────────────────────
function SelectProperties({
  data, onUpdate, upstreamCols,
}: { data: SelectNodeData; onUpdate: (d: Partial<SelectNodeData>) => void; upstreamCols: string[] }) {
  const cols = data.columns ?? []

  const addCol = () => {
    onUpdate({ columns: [...cols, { id: uuidv4(), name: '', alias: '' }] })
  }

  const updateCol = (id: string, patch: Partial<Column>) => {
    onUpdate({ columns: cols.map(c => c.id === id ? { ...c, ...patch } : c) })
  }

  const removeCol = (id: string) => {
    onUpdate({ columns: cols.filter(c => c.id !== id) })
  }

  return (
    <div>
      <Field label="DISTINCT">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            id="distinct-cb"
            checked={data.distinct ?? false}
            onChange={e => onUpdate({ distinct: e.target.checked })}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <label htmlFor="distinct-cb" style={{ color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
            SELECT DISTINCT
          </label>
        </div>
      </Field>

      <Field label="Colunas">
        {upstreamCols.length === 0 && (
          <div className="mpp-hint" style={{ marginBottom: 8 }}>
            Conecte um nó Table para ver colunas disponíveis.
          </div>
        )}
        {cols.map(col => (
          <div key={col.id} style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <UpstreamColSelect
              value={col.name}
              upstreamCols={upstreamCols}
              onChange={v => updateCol(col.id, { name: v })}
              style={{ flex: 2 }}
            />
            <input
              className="prop-input"
              value={col.alias}
              placeholder="alias"
              onChange={e => updateCol(col.id, { alias: e.target.value })}
              style={{ flex: 1 }}
            />
            <button className="btn btn-danger" onClick={() => removeCol(col.id)} style={{ padding: '6px 8px', flexShrink: 0 }}>✕</button>
          </div>
        ))}
        <button className="add-btn" onClick={addCol}>+ Adicionar coluna</button>
      </Field>
    </div>
  )
}

// ─── Join Properties ─────────────────────────────────────────
// For join, upstream columns come from both left and right inputs separately.
// We simplify by collecting all upstream cols and letting the user pick both sides.
function JoinProperties({
  data, onUpdate, upstreamCols,
}: { data: JoinNodeData; onUpdate: (d: Partial<JoinNodeData>) => void; upstreamCols: string[] }) {
  // Parse condition into left/op/right if it matches "a = b"
  const condMatch = data.condition?.match(/^(\S+)\s*(=|!=|<>|<|>|<=|>=)\s*(\S+)$/)
  const [leftCol, setLeftCol] = useState(condMatch?.[1] ?? '')
  const [op, setOp] = useState(condMatch?.[2] ?? '=')
  const [rightCol, setRightCol] = useState(condMatch?.[3] ?? '')

  function buildCondition(l: string, o: string, r: string) {
    if (l && r) onUpdate({ condition: `${l} ${o} ${r}` })
  }

  return (
    <div>
      <Field label="Tipo de Join">
        <select
          className="prop-select"
          value={data.joinType || 'INNER'}
          onChange={e => onUpdate({ joinType: e.target.value as JoinNodeData['joinType'] })}
        >
          <option value="INNER">INNER JOIN</option>
          <option value="LEFT">LEFT JOIN</option>
          <option value="RIGHT">RIGHT JOIN</option>
          <option value="FULL OUTER">FULL OUTER JOIN</option>
          <option value="CROSS">CROSS JOIN</option>
        </select>
      </Field>

      <Field label="Condição (ON)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 4, marginBottom: 6 }}>
          <UpstreamColSelect
            value={leftCol}
            upstreamCols={upstreamCols}
            onChange={v => { setLeftCol(v); buildCondition(v, op, rightCol) }}
            placeholder="col esquerda"
          />
          <select
            className="prop-select"
            value={op}
            onChange={e => { setOp(e.target.value); buildCondition(leftCol, e.target.value, rightCol) }}
            style={{ width: 60 }}
          >
            {['=', '!=', '<', '>', '<=', '>='].map(o => <option key={o}>{o}</option>)}
          </select>
          <UpstreamColSelect
            value={rightCol}
            upstreamCols={upstreamCols}
            onChange={v => { setRightCol(v); buildCondition(leftCol, op, v) }}
            placeholder="col direita"
          />
        </div>
        {data.condition && (
          <div style={{
            background: '#0a0f1e', borderRadius: 6, padding: '6px 10px',
            fontFamily: 'monospace', fontSize: 12, color: '#7dd3fc',
          }}>
            ON {data.condition}
          </div>
        )}
        <div className="mpp-hint" style={{ marginTop: 6 }}>
          ⬅ Handle superior: tabela esquerda &nbsp;·&nbsp; ⬅ Handle inferior: tabela direita
        </div>
      </Field>
    </div>
  )
}

// ─── Filter Properties ────────────────────────────────────────
const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL']
const NO_VALUE_OPS = new Set(['IS NULL', 'IS NOT NULL'])

function FilterProperties({
  data, onUpdate, upstreamCols,
}: { data: FilterNodeData; onUpdate: (d: Partial<FilterNodeData>) => void; upstreamCols: string[] }) {
  const conditions = data.conditions ?? []

  const add = () => onUpdate({
    conditions: [...conditions, { id: uuidv4(), column: '', operator: '=', value: '', logic: 'AND' }],
  })
  const update = (id: string, patch: Partial<FilterCondition>) =>
    onUpdate({ conditions: conditions.map(c => c.id === id ? { ...c, ...patch } : c) })
  const remove = (id: string) =>
    onUpdate({ conditions: conditions.filter(c => c.id !== id) })

  return (
    <div>
      <Field label="Condições">
        {upstreamCols.length === 0 && (
          <div className="mpp-hint" style={{ marginBottom: 8 }}>Conecte um nó Table para ver colunas.</div>
        )}
        {conditions.map((cond, i) => (
          <div key={cond.id} style={{ marginBottom: 10, background: '#0f172a', borderRadius: 8, padding: 10 }}>
            {i > 0 && (
              <div style={{ marginBottom: 6 }}>
                <select
                  className="prop-select"
                  value={cond.logic}
                  onChange={e => update(cond.id, { logic: e.target.value as 'AND' | 'OR' })}
                  style={{ width: 80 }}
                >
                  <option>AND</option>
                  <option>OR</option>
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <UpstreamColSelect
                value={cond.column}
                upstreamCols={upstreamCols}
                onChange={v => update(cond.id, { column: v })}
                style={{ flex: 1 }}
              />
              <button className="btn btn-danger" onClick={() => remove(cond.id)} style={{ padding: '6px 8px' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <select
                className="prop-select"
                value={cond.operator}
                onChange={e => update(cond.id, { operator: e.target.value })}
                style={{ flex: 1 }}
              >
                {OPERATORS.map(op => <option key={op}>{op}</option>)}
              </select>
              {!NO_VALUE_OPS.has(cond.operator) && (
                <input
                  className="prop-input"
                  value={cond.value}
                  placeholder="valor"
                  onChange={e => update(cond.id, { value: e.target.value })}
                  style={{ flex: 1 }}
                />
              )}
            </div>
          </div>
        ))}
        <button className="add-btn" onClick={add}>+ Adicionar condição</button>
      </Field>
    </div>
  )
}

// ─── GroupBy Properties ───────────────────────────────────────
const AGG_FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT DISTINCT'] as const

function GroupByProperties({
  data, onUpdate, upstreamCols,
}: { data: GroupByNodeData; onUpdate: (d: Partial<GroupByNodeData>) => void; upstreamCols: string[] }) {
  const aggs = data.aggregations ?? []
  const cols = data.columns ?? []

  const addAgg = () => onUpdate({ aggregations: [...aggs, { id: uuidv4(), column: '', func: 'COUNT', alias: '' }] })
  const updateAgg = (id: string, patch: Partial<Aggregation>) =>
    onUpdate({ aggregations: aggs.map(a => a.id === id ? { ...a, ...patch } : a) })
  const removeAgg = (id: string) => onUpdate({ aggregations: aggs.filter(a => a.id !== id) })

  const toggleGroupCol = (col: string) => {
    if (cols.includes(col)) {
      onUpdate({ columns: cols.filter(c => c !== col) })
    } else {
      onUpdate({ columns: [...cols, col] })
    }
  }

  return (
    <div>
      <Field label="Colunas de Agrupamento">
        {upstreamCols.length === 0 ? (
          <div className="mpp-hint">Conecte um nó Table para ver colunas.</div>
        ) : (
          <div className="col-picker-list" style={{ marginBottom: 6 }}>
            {upstreamCols.map(col => (
              <label key={col} className="col-picker-row">
                <input
                  type="checkbox"
                  checked={cols.includes(col)}
                  onChange={() => toggleGroupCol(col)}
                />
                <span className="col-picker-name">{col}</span>
              </label>
            ))}
          </div>
        )}
      </Field>

      <Field label="Agregações">
        {aggs.map(agg => (
          <div key={agg.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 4, marginBottom: 6 }}>
            <select
              className="prop-select"
              value={agg.func}
              onChange={e => updateAgg(agg.id, { func: e.target.value as Aggregation['func'] })}
            >
              {AGG_FUNCTIONS.map(f => <option key={f}>{f}</option>)}
            </select>
            <UpstreamColSelect
              value={agg.column}
              upstreamCols={upstreamCols}
              onChange={v => updateAgg(agg.id, { column: v })}
              placeholder="coluna"
            />
            <input
              className="prop-input"
              value={agg.alias}
              placeholder="alias"
              onChange={e => updateAgg(agg.id, { alias: e.target.value })}
            />
            <button className="btn btn-danger" onClick={() => removeAgg(agg.id)} style={{ padding: '6px 8px' }}>✕</button>
          </div>
        ))}
        <button className="add-btn" onClick={addAgg}>+ Adicionar agregação</button>
      </Field>

      <Field label="HAVING">
        <input
          className="prop-input"
          value={data.having || ''}
          placeholder="COUNT(*) > 10"
          onChange={e => onUpdate({ having: e.target.value })}
        />
        <div className="mpp-hint">HAVING aceita expressões livres com agregações.</div>
      </Field>
    </div>
  )
}

// ─── OrderBy Properties ──────────────────────────────────────
function OrderByProperties({
  data, onUpdate, upstreamCols,
}: { data: OrderByNodeData; onUpdate: (d: Partial<OrderByNodeData>) => void; upstreamCols: string[] }) {
  const cols = data.orderColumns ?? []

  const add = () => onUpdate({ orderColumns: [...cols, { id: uuidv4(), column: '', direction: 'ASC' }] })
  const update = (id: string, patch: Partial<OrderColumn>) =>
    onUpdate({ orderColumns: cols.map(c => c.id === id ? { ...c, ...patch } : c) })
  const remove = (id: string) => onUpdate({ orderColumns: cols.filter(c => c.id !== id) })

  return (
    <div>
      <Field label="Ordenação">
        {upstreamCols.length === 0 && (
          <div className="mpp-hint" style={{ marginBottom: 8 }}>Conecte um nó Table para ver colunas.</div>
        )}
        {cols.map(col => (
          <div key={col.id} style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <UpstreamColSelect
              value={col.column}
              upstreamCols={upstreamCols}
              onChange={v => update(col.id, { column: v })}
              style={{ flex: 2 }}
            />
            <select
              className="prop-select"
              value={col.direction}
              onChange={e => update(col.id, { direction: e.target.value as 'ASC' | 'DESC' })}
              style={{ flex: 1 }}
            >
              <option>ASC</option>
              <option>DESC</option>
            </select>
            <button className="btn btn-danger" onClick={() => remove(col.id)} style={{ padding: '6px 8px' }}>✕</button>
          </div>
        ))}
        <button className="add-btn" onClick={add}>+ Adicionar coluna</button>
      </Field>

      <Field label="LIMIT">
        <input
          className="prop-input"
          type="number"
          value={data.limit || ''}
          placeholder="100"
          min={1}
          onChange={e => onUpdate({ limit: e.target.value })}
        />
      </Field>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────
export default function PropertiesPanel({ node, nodes, edges, onUpdate }: Props) {
  const upstreamCols = node ? getUpstreamColumns(node.id, nodes, edges) : []

  if (!node) {
    return (
      <div className="properties-panel">
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>🖱️</div>
          <p>Clique em um nó para ver e editar suas propriedades</p>
        </div>
      </div>
    )
  }

  const catalog = NODE_CATALOG.find(c => c.type === node.type)
  const nodeType = node.type as string

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{catalog?.icon}</span>
          <div>
            <h3>{catalog?.label || node.type}</h3>
            <div style={{ color: '#64748b', fontSize: 11 }}>ID: {node.id.slice(0, 8)}</div>
          </div>
        </div>
      </div>

      <div className="properties-body">
        {nodeType === 'table' && (
          <TableProperties data={node.data as TableNodeData} onUpdate={onUpdate} />
        )}
        {nodeType === 'select' && (
          <SelectProperties data={node.data as SelectNodeData} onUpdate={onUpdate} upstreamCols={upstreamCols} />
        )}
        {nodeType === 'join' && (
          <JoinProperties data={node.data as JoinNodeData} onUpdate={onUpdate} upstreamCols={upstreamCols} />
        )}
        {nodeType === 'filter' && (
          <FilterProperties data={node.data as FilterNodeData} onUpdate={onUpdate} upstreamCols={upstreamCols} />
        )}
        {nodeType === 'groupBy' && (
          <GroupByProperties data={node.data as GroupByNodeData} onUpdate={onUpdate} upstreamCols={upstreamCols} />
        )}
        {nodeType === 'orderBy' && (
          <OrderByProperties data={node.data as OrderByNodeData} onUpdate={onUpdate} upstreamCols={upstreamCols} />
        )}
        {nodeType === 'output' && (
          <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.7 }}>
            O nó Output exibe o AST JSON gerado automaticamente a partir dos nós conectados.
            <br /><br />
            Conecte o fluxo de nós até este Output para visualizar.
          </div>
        )}
      </div>
    </div>
  )
}
