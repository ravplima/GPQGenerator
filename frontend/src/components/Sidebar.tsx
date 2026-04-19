import { NODE_CATALOG } from '../types'
import type { NodeType } from '../types'

function onDragStart(event: React.DragEvent, nodeType: NodeType) {
  event.dataTransfer.setData('application/reactflow', nodeType)
  event.dataTransfer.effectAllowed = 'move'
}

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>GenQuery</h2>
        <p>SQL Visual Builder</p>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Nós SQL</div>
        <p style={{ color: '#475569', fontSize: 11, marginBottom: 12 }}>
          Arraste para o canvas para adicionar
        </p>

        {NODE_CATALOG.map(item => (
          <div
            key={item.type}
            className="node-item"
            draggable
            onDragStart={e => onDragStart(e, item.type)}
          >
            <div className="node-icon" style={{ background: `${item.color}22`, border: `1px solid ${item.color}44` }}>
              {item.icon}
            </div>
            <div className="node-info">
              <h3>{item.label}</h3>
              <p>{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid #0f3460' }}>
        <p style={{ color: '#475569', fontSize: 11, lineHeight: 1.5 }}>
          💡 Conecte os nós para gerar SQL automaticamente. O nó <strong style={{ color: '#94a3b8' }}>Output</strong> exibe o SQL resultante.
        </p>
      </div>
    </aside>
  )
}
