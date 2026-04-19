import { v4 as uuidv4 } from 'uuid'
import type { SelectNodeData, Column } from '../../types'
import { Field, UpstreamColSelect } from './shared'

export function SelectProperties({
  data,
  onUpdate,
  upstreamCols,
}: {
  data: SelectNodeData
  onUpdate: (d: Partial<SelectNodeData>) => void
  upstreamCols: string[]
}) {
  const cols = data.columns ?? []

  const addCol = () =>
    onUpdate({ columns: [...cols, { id: uuidv4(), name: '', alias: '' }] })

  const updateCol = (id: string, patch: Partial<Column>) =>
    onUpdate({ columns: cols.map(c => c.id === id ? { ...c, ...patch } : c) })

  const removeCol = (id: string) =>
    onUpdate({ columns: cols.filter(c => c.id !== id) })

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
