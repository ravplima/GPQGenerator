import { useMemo } from 'react'
import { Handle, Position, useNodes, useEdges } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { OutputNodeData, AppNode } from '../types'
import { useMPP } from '../context/MPPContext'
import { generateAST } from '../utils/astGenerator'

type OutputNode = Node<OutputNodeData, 'output'>

export default function OutputNode({ id, selected }: NodeProps<OutputNode>) {
  const nodes = useNodes() as AppNode[]
  const edges = useEdges()
  const { config: mpp } = useMPP()

  const ast = useMemo(
    () => generateAST(nodes, edges, id, mpp),
    [nodes, edges, id, mpp],
  )

  const json = ast
    ? JSON.stringify(ast, null, 2)
    : '// Conecte nós ao Output para gerar o AST'

  const lineCount = json.split('\n').length

  return (
    <div className={`sql-node${selected ? ' selected' : ''}`} style={{ minWidth: 300 }}>
      <Handle type="target" position={Position.Left} id="input" />
      <div className="sql-node-header" style={{ background: '#334155' }}>
        <span className="sql-node-icon">📤</span>
        <span className="sql-node-title">Output — Query AST</span>
        {ast && (
          <span style={{
            marginLeft: 'auto',
            background: '#1e3a5f',
            color: '#7dd3fc',
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
          }}>
            JSON
          </span>
        )}
      </div>
      <div className="sql-node-body">
        <div className="ast-preview">
          {json}
        </div>
        {ast && (
          <div style={{ marginTop: 6, color: '#475569', fontSize: 10, textAlign: 'right' }}>
            {lineCount} linhas · genquery/v1
          </div>
        )}
      </div>
    </div>
  )
}
