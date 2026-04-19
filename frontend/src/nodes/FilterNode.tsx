import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { FilterNodeData } from '../types'

type FilterNode = Node<FilterNodeData, 'filter'>

export default function FilterNode({ data, selected }: NodeProps<FilterNode>) {
  const conditions = data.conditions || []

  return (
    <div className={`sql-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="input" />
      <div className="sql-node-header" style={{ background: '#b45309' }}>
        <span className="sql-node-icon">🔺</span>
        <span className="sql-node-title">Filter (WHERE)</span>
      </div>
      <div className="sql-node-body">
        {conditions.length === 0 ? (
          <div className="sql-node-field" style={{ color: '#475569' }}>Sem condições</div>
        ) : (
          conditions.slice(0, 3).map((c, i) => (
            <div key={c.id} className="sql-node-field">
              {i > 0 && <span style={{ color: '#f59e0b', marginRight: 4 }}>{c.logic}</span>}
              <span>{c.column} {c.operator} {c.value}</span>
            </div>
          ))
        )}
        {conditions.length > 3 && (
          <div className="sql-node-field" style={{ color: '#475569' }}>+{conditions.length - 3} mais…</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
