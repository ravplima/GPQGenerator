import type { Edge } from '@xyflow/react'
import type {
  AppNode,
  TableNodeData, SelectNodeData, JoinNodeData, FilterNodeData,
  GroupByNodeData, OrderByNodeData,
} from '../types'
import { NODE_CATALOG } from '../types'
import { getUpstreamColumns } from '../utils/upstreamColumns'
import { TableProperties } from './properties/TableProperties'
import { SelectProperties } from './properties/SelectProperties'
import { JoinProperties } from './properties/JoinProperties'
import { FilterProperties } from './properties/FilterProperties'
import { GroupByProperties } from './properties/GroupByProperties'
import { OrderByProperties } from './properties/OrderByProperties'

interface Props {
  node: AppNode | null
  nodes: AppNode[]
  edges: Edge[]
  onUpdate: (data: Record<string, unknown>) => void
}

export default function PropertiesPanel({ node, nodes, edges, onUpdate }: Props) {
  const upstreamCols = node ? getUpstreamColumns(node.id, nodes, edges) : []

  if (!node) {
    return (
      <div className="properties-panel">
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>🖱️</div>
          <p>Clique em um nó para ver e editar suas propriedades</p>
        </div>
      </div>
    )
  }

  const catalog = NODE_CATALOG.find(c => c.type === node.type)
  const nodeType = node.type as string

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{catalog?.icon}</span>
          <div>
            <h3>{catalog?.label || node.type}</h3>
            <div style={{ color: '#64748b', fontSize: 11 }}>ID: {node.id.slice(0, 8)}</div>
          </div>
        </div>
      </div>

      <div className="properties-body">
        {nodeType === 'table' && (
          <TableProperties data={node.data as TableNodeData} onUpdate={onUpdate} />
        )}
        {nodeType === 'select' && (
          <SelectProperties data={node.data as SelectNodeData} onUpdate={onUpdate} upstreamCols={upstreamCols} />
        )}
        {nodeType === 'join' && (
          <JoinProperties data={node.data as JoinNodeData} onUpdate={onUpdate} upstreamCols={upstreamCols} />
        )}
        {nodeType === 'filter' && (
          <FilterProperties data={node.data as FilterNodeData} onUpdate={onUpdate} upstreamCols={upstreamCols} />
        )}
        {nodeType === 'groupBy' && (
          <GroupByProperties data={node.data as GroupByNodeData} onUpdate={onUpdate} upstreamCols={upstreamCols} />
        )}
        {nodeType === 'orderBy' && (
          <OrderByProperties data={node.data as OrderByNodeData} onUpdate={onUpdate} upstreamCols={upstreamCols} />
        )}
        {nodeType === 'output' && (
          <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.7 }}>
            O nó Output exibe o AST JSON gerado automaticamente a partir dos nós conectados.
            <br /><br />
            Conecte o fluxo de nós até este Output para visualizar.
          </div>
        )}
      </div>
    </div>
  )
}
