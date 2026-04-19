import { v4 as uuidv4 } from 'uuid'
import type { FilterNodeData, FilterCondition } from '../../types'
import { Field, UpstreamColSelect } from './shared'

const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL']
const NO_VALUE_OPS = new Set(['IS NULL', 'IS NOT NULL'])

export function FilterProperties({
  data,
  onUpdate,
  upstreamCols,
}: {
  data: FilterNodeData
  onUpdate: (d: Partial<FilterNodeData>) => void
  upstreamCols: string[]
}) {
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
