import { v4 as uuidv4 } from 'uuid'
import type { OrderByNodeData, OrderColumn } from '../../types'
import { Field, UpstreamColSelect } from './shared'

export function OrderByProperties({
  data,
  onUpdate,
  upstreamCols,
}: {
  data: OrderByNodeData
  onUpdate: (d: Partial<OrderByNodeData>) => void
  upstreamCols: string[]
}) {
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
