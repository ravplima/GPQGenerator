import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { JoinNodeData } from '../types'

type JoinNode = Node<JoinNodeData, 'join'>

const JOIN_COLORS: Record<string, string> = {
  INNER: '#5b21b6',
  LEFT: '#6d28d9',
  RIGHT: '#7c3aed',
  'FULL OUTER': '#8b5cf6',
  CROSS: '#a78bfa',
}

export default function JoinNode({ data, selected }: NodeProps<JoinNode>) {
  const joinType = data.joinType || 'INNER'
  const condition = data.condition || ''

  return (
    <div className={`sql-node${selected ? ' selected' : ''}`} style={{ minWidth: 200 }}>
      <Handle
        type="target"
        position={Position.Left}
        id="input-left"
        style={{ top: '35%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input-right"
        style={{ top: '65%' }}
      />
      <div className="sql-node-header" style={{ background: JOIN_COLORS[joinType] || '#6d28d9' }}>
        <span className="sql-node-icon">🔗</span>
        <span className="sql-node-title">{joinType} JOIN</span>
      </div>
      <div className="sql-node-body">
        <div className="sql-node-field">
          <span style={{ color: '#64748b' }}>ON </span>
          <span>{condition || '—'}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: '#475569' }}>
          <div>← Entrada Esquerda (35%)</div>
          <div>← Entrada Direita (65%)</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
