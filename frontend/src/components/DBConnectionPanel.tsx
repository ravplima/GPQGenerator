import { useState } from 'react'
import { useMetadata } from '../context/MetadataContext'
import type { ConnectionConfig } from '../types'

interface Props {
  onClose: () => void
}

const STATUS_COLOR: Record<string, string> = {
  idle: '#475569',
  connecting: '#f59e0b',
  connected: '#10b981',
  error: '#ef4444',
}

const STATUS_ICON: Record<string, string> = {
  idle: '○',
  connecting: '◌',
  connected: '●',
  error: '✕',
}

export default function DBConnectionPanel({ onClose }: Props) {
  const { status, statusMessage, store, connect, disconnect, loadSchemas } = useMetadata()

  const [form, setForm] = useState<ConnectionConfig>({
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
  })
  const [testing, setTesting] = useState(false)

  function patch(partial: Partial<ConnectionConfig>) {
    setForm(f => ({ ...f, ...partial }))
  }

  async function handleConnect() {
    setTesting(true)
    try {
      const ok = await connect(form)
      if (ok) await loadSchemas()
    } finally {
      setTesting(false)
    }
  }

  const isConnected = status === 'connected'

  return (
    <div className="mpp-panel">
      {/* Header */}
      <div className="mpp-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🔌</span>
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>Conexão ao Banco</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <span style={{ color: STATUS_COLOR[status], fontSize: 12 }}>{STATUS_ICON[status]}</span>
              <span style={{ color: '#64748b', fontSize: 11 }}>
                {statusMessage || 'Sem conexão'}
              </span>
            </div>
          </div>
        </div>
        <button className="mpp-close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="mpp-panel-body">
        <div className="mpp-section">
          <div className="mpp-section-title">Credenciais</div>

          {/* Host + Port */}
          <div className="prop-group">
            <label className="prop-label">Host</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="prop-input"
                value={form.host}
                placeholder="localhost"
                onChange={e => patch({ host: e.target.value })}
                disabled={isConnected}
                style={{ flex: 3 }}
              />
              <input
                className="prop-input"
                type="number"
                value={form.port}
                placeholder="5432"
                onChange={e => patch({ port: parseInt(e.target.value, 10) || 5432 })}
                disabled={isConnected}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="prop-group">
            <label className="prop-label">Database</label>
            <input
              className="prop-input"
              value={form.database}
              placeholder="nome_do_banco"
              onChange={e => patch({ database: e.target.value })}
              disabled={isConnected}
            />
          </div>

          <div className="prop-group">
            <label className="prop-label">Usuário</label>
            <input
              className="prop-input"
              value={form.username}
              placeholder="gpadmin"
              onChange={e => patch({ username: e.target.value })}
              disabled={isConnected}
              autoComplete="username"
            />
          </div>

          <div className="prop-group">
            <label className="prop-label">Senha</label>
            <input
              className="prop-input"
              type="password"
              value={form.password}
              placeholder="••••••••"
              onChange={e => patch({ password: e.target.value })}
              disabled={isConnected}
              autoComplete="current-password"
            />
          </div>

          {/* Actions */}
          {!isConnected ? (
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '9px 0', marginTop: 4 }}
              onClick={handleConnect}
              disabled={testing || !form.host || !form.database || !form.username}
            >
              {testing ? '⏳ Conectando…' : '🔌 Conectar'}
            </button>
          ) : (
            <button
              className="btn btn-danger"
              style={{ width: '100%', padding: '9px 0', marginTop: 4 }}
              onClick={disconnect}
            >
              Desconectar
            </button>
          )}

          {status === 'error' && (
            <div className="mpp-hint mpp-hint-warning" style={{ marginTop: 10 }}>
              {statusMessage}
            </div>
          )}
        </div>

        {/* Schema browser (shown when connected) */}
        {isConnected && (
          <div className="mpp-section">
            <div className="mpp-section-title">Schemas disponíveis</div>
            {store.schemas.length === 0 ? (
              <div className="mpp-hint">Nenhum schema carregado ainda. Adicione um nó Table e selecione o schema.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {store.schemas.map(s => (
                  <span key={s} className="tag">{s}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mpp-section">
          <div className="mpp-hint mpp-hint-info">
            A senha é enviada apenas ao backend e nunca armazenada no browser. As credenciais são usadas exclusivamente para consultar metadados (schemas, tabelas, colunas).
          </div>
        </div>
      </div>
    </div>
  )
}
