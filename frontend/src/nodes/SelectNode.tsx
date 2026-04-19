import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { SelectNodeData } from '../types'

type SelectNode = Node<SelectNodeData, 'select'>

export default function SelectNode({ data, selected }: NodeProps<SelectNode>) {
  const cols = data.columns || []
  const distinct = data.distinct || false

  return (
    <div className={`sql-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="input" />
      <div className="sql-node-header" style={{ background: '#047857' }}>
        <span className="sql-node-icon">🔍</span>
        <span className="sql-node-title">SELECT{distinct ? ' DISTINCT' : ''}</span>
      </div>
      <div className="sql-node-body">
        {cols.length === 0 ? (
          <div className="sql-node-field" style={{ color: '#475569' }}>Todas as colunas (*)</div>
        ) : (
          cols.slice(0, 4).map(c => (
            <div key={c.id} className="sql-node-field">
              <strong>{c.name}</strong>
              {c.alias && <span style={{ color: '#64748b' }}> → {c.alias}</span>}
            </div>
          ))
        )}
        {cols.length > 4 && (
          <div className="sql-node-field" style={{ color: '#475569' }}>+{cols.length - 4} mais…</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
