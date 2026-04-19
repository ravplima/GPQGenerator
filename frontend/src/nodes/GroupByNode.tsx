import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { GroupByNodeData } from '../types'

type GroupByNode = Node<GroupByNodeData, 'groupBy'>

export default function GroupByNode({ data, selected }: NodeProps<GroupByNode>) {
  const columns = data.columns || []
  const aggregations = data.aggregations || []

  return (
    <div className={`sql-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="input" />
      <div className="sql-node-header" style={{ background: '#be185d' }}>
        <span className="sql-node-icon">📊</span>
        <span className="sql-node-title">Group By</span>
      </div>
      <div className="sql-node-body">
        {columns.length > 0 && (
          <div className="sql-node-field">
            <span style={{ color: '#64748b' }}>BY: </span>
            <strong>{columns.join(', ')}</strong>
          </div>
        )}
        {aggregations.slice(0, 3).map(a => (
          <div key={a.id} className="sql-node-field">
            <span style={{ color: '#ec4899' }}>{a.func}({a.column})</span>
            {a.alias && <span style={{ color: '#64748b' }}> → {a.alias}</span>}
          </div>
        ))}
        {aggregations.length === 0 && columns.length === 0 && (
          <div className="sql-node-field" style={{ color: '#475569' }}>Sem configuração</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
