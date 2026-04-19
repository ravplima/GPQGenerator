import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { OrderByNodeData } from '../types'

type OrderByNode = Node<OrderByNodeData, 'orderBy'>

export default function OrderByNode({ data, selected }: NodeProps<OrderByNode>) {
  const orderColumns = data.orderColumns || []
  const limit = data.limit || ''

  return (
    <div className={`sql-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="input" />
      <div className="sql-node-header" style={{ background: '#0369a1' }}>
        <span className="sql-node-icon">↕️</span>
        <span className="sql-node-title">Order By</span>
      </div>
      <div className="sql-node-body">
        {orderColumns.length === 0 ? (
          <div className="sql-node-field" style={{ color: '#475569' }}>Sem ordenação</div>
        ) : (
          orderColumns.slice(0, 3).map(c => (
            <div key={c.id} className="sql-node-field">
              <strong>{c.column}</strong>
              <span style={{ color: c.direction === 'ASC' ? '#34d399' : '#f87171', marginLeft: 4 }}>
                {c.direction}
              </span>
            </div>
          ))
        )}
        {limit && (
          <div className="sql-node-field" style={{ marginTop: 4 }}>
            <span style={{ color: '#64748b' }}>LIMIT </span>
            <strong>{limit}</strong>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
