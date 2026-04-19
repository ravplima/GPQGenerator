import { useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
} from '@xyflow/react'
import type { Connection, OnSelectionChangeParams, Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import Sidebar from './components/Sidebar'
import PropertiesPanel from './components/PropertiesPanel'
import MPPPanel from './components/MPPPanel'
import DBConnectionPanel from './components/DBConnectionPanel'
import TableNode from './nodes/TableNode'
import SelectNode from './nodes/SelectNode'
import JoinNode from './nodes/JoinNode'
import FilterNode from './nodes/FilterNode'
import GroupByNode from './nodes/GroupByNode'
import OrderByNode from './nodes/OrderByNode'
import OutputNode from './nodes/OutputNode'
import { MPPContext } from './context/MPPContext'
import { MetadataProvider } from './context/MetadataContext'
import type { AppNode, NodeType, MPPConfig } from './types'
import { DEFAULT_MPP_CONFIG } from './types'
import { v4 as uuidv4 } from 'uuid'

const nodeTypes = {
  table: TableNode,
  select: SelectNode,
  join: JoinNode,
  filter: FilterNode,
  groupBy: GroupByNode,
  orderBy: OrderByNode,
  output: OutputNode,
}

function defaultData(type: NodeType): Record<string, unknown> {
  switch (type) {
    case 'table':   return { label: 'Table', tableName: 'my_table', schema: 'public', alias: 't', columns: [] }
    case 'select':  return { label: 'Select', columns: [], distinct: false }
    case 'join':    return { label: 'Join', joinType: 'INNER', condition: '' }
    case 'filter':  return { label: 'Filter', conditions: [] }
    case 'groupBy': return { label: 'Group By', columns: [], aggregations: [], having: '' }
    case 'orderBy': return { label: 'Order By', orderColumns: [], limit: '' }
    case 'output':  return { label: 'Output' }
    default:        return { label: type }
  }
}

const initialNodes: AppNode[] = []
const initialEdges: Edge[] = []

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showMPP, setShowMPP] = useState(false)
  const [showDB, setShowDB] = useState(false)
  const [mppConfig, setMppConfig] = useState<MPPConfig>(DEFAULT_MPP_CONFIG)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  )

  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    setSelectedNodeId(sel[0]?.id ?? null)
  }, [])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow') as NodeType
      if (!type) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const newNode = { id: uuidv4(), type, position, data: defaultData(type) } as AppNode
      setNodes(nds => [...nds, newNode])
    },
    [screenToFlowPosition, setNodes],
  )

  const onUpdateNodeData = useCallback(
    (data: Record<string, unknown>) => {
      if (!selectedNodeId) return
      setNodes(nds =>
        nds.map(n =>
          n.id === selectedNodeId ? ({ ...n, data: { ...n.data, ...data } } as AppNode) : n
        ),
      )
    },
    [selectedNodeId, setNodes],
  )

  const clearCanvas = useCallback(() => {
    setNodes([])
    setEdges([])
    setSelectedNodeId(null)
  }, [setNodes, setEdges])

  return (
    <MPPContext.Provider value={{ config: mppConfig, setConfig: setMppConfig }}>
      <div className="app">
        <Sidebar />

        <div className="canvas-wrapper" ref={reactFlowWrapper}>
          {/* Toolbar */}
          <div className="toolbar">
            <button
              onClick={() => { setShowDB(v => !v); setShowMPP(false) }}
              className={showDB ? 'toolbar-btn-active' : ''}
            >
              🔌 Banco
            </button>
            <button
              onClick={() => { setShowMPP(v => !v); setShowDB(false) }}
              className={showMPP ? 'toolbar-btn-active' : ''}
            >
              ⚡ MPP Config
            </button>
            <button onClick={clearCanvas}>🗑️ Limpar</button>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            snapToGrid
            snapGrid={[16, 16]}
            defaultEdgeOptions={{ animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }}
          >
            <Background color="#1e293b" variant={BackgroundVariant.Dots} gap={20} size={1.5} />
            <Controls style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8 }} />
            <MiniMap
              style={{ background: '#0f172a', border: '1px solid #1e3a5f' }}
              nodeColor={node => {
                const colors: Record<string, string> = {
                  table: '#2563eb', select: '#059669', join: '#7c3aed',
                  filter: '#d97706', groupBy: '#db2777', orderBy: '#0891b2', output: '#475569',
                }
                return colors[node.type || ''] || '#334155'
              }}
            />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="canvas-hint">
              <div style={{ fontSize: 40, marginBottom: 12 }}>⬅</div>
              <p>Arraste nós da barra lateral para começar</p>
              <p style={{ marginTop: 8, fontSize: 13 }}>Conecte ao Output para gerar o AST JSON</p>
            </div>
          )}
        </div>

        {showDB && <DBConnectionPanel onClose={() => setShowDB(false)} />}
        {showMPP && <MPPPanel onClose={() => setShowMPP(false)} />}

        <PropertiesPanel node={selectedNode} nodes={nodes} edges={edges} onUpdate={onUpdateNodeData} />
      </div>
    </MPPContext.Provider>
  )
}

export default function App() {
  return (
    <MetadataProvider>
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </MetadataProvider>
  )
}
