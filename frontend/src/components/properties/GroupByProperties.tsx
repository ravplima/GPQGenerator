import { v4 as uuidv4 } from 'uuid'
import type { GroupByNodeData, Aggregation } from '../../types'
import { Field, UpstreamColSelect } from './shared'

const AGG_FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT DISTINCT'] as const

export function GroupByProperties({
  data,
  onUpdate,
  upstreamCols,
}: {
  data: GroupByNodeData
  onUpdate: (d: Partial<GroupByNodeData>) => void
  upstreamCols: string[]
}) {
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
        <div className="mpp-hint">Formato: AGG(col) OPERADOR número</div>
      </Field>
    </div>
  )
}
