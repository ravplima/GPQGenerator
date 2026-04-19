import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { TableNodeData } from '../types'

type TableNode = Node<TableNodeData, 'table'>

export default function TableNode({ data, selected }: NodeProps<TableNode>) {
  const tableName = data.tableName || 'table_name'
  const schema = data.schema ? `${data.schema}.` : ''
  const alias = data.alias || ''
  const cols = data.columns || []

  return (
    <div className={`sql-node${selected ? ' selected' : ''}`}>
      <div className="sql-node-header" style={{ background: '#1d4ed8' }}>
        <span className="sql-node-icon">🗄️</span>
        <span className="sql-node-title">Table Source</span>
      </div>
      <div className="sql-node-body">
        <div className="sql-node-field">
          <strong>{schema}{tableName}</strong>
          {alias && <span style={{ color: '#64748b' }}> AS {alias}</span>}
        </div>
        {cols.length > 0 && (
          <div className="sql-node-field" style={{ marginTop: 4 }}>
            <span style={{ color: '#64748b' }}>{cols.length} col{cols.length > 1 ? 's' : ''}: </span>
            <span style={{ color: '#94a3b8' }}>{cols.slice(0, 3).join(', ')}{cols.length > 3 ? '…' : ''}</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
