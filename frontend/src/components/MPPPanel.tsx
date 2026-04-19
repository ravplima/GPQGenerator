import { useState } from 'react'
import { useMPP } from '../context/MPPContext'
import type { MPPConfig } from '../types'

interface Props {
  onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mpp-section">
      <div className="mpp-section-title">{title}</div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="prop-group">
      <label className="prop-label">{label}</label>
      {children}
    </div>
  )
}

export default function MPPPanel({ onClose }: Props) {
  const { config, setConfig } = useMPP()
  const [newDistCol, setNewDistCol] = useState('')

  function patch(partial: Partial<MPPConfig>) {
    setConfig({ ...config, ...partial })
  }

  function patchDistrib(partial: Partial<MPPConfig['distributedBy']>) {
    patch({ distributedBy: { ...config.distributedBy, ...partial } })
  }

  const addDistCol = () => {
    const col = newDistCol.trim()
    if (!col) return
    patchDistrib({ columns: [...config.distributedBy.columns, col] })
    setNewDistCol('')
  }

  const removeDistCol = (col: string) => {
    patchDistrib({ columns: config.distributedBy.columns.filter(c => c !== col) })
  }

  return (
    <div className="mpp-panel">
      {/* Header */}
      <div className="mpp-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>Greenplum MPP</div>
            <div style={{ color: '#64748b', fontSize: 11 }}>Configurações de paralelismo</div>
          </div>
        </div>
        <button className="mpp-close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="mpp-panel-body">

        {/* ── Distribution ───────────────────────────────────── */}
        <Section title="Distribuição de Dados">
          <Field label="Método de Distribuição">
            <select
              className="prop-select"
              value={config.distributedBy.type}
              onChange={e => patchDistrib({ type: e.target.value as MPPConfig['distributedBy']['type'] })}
            >
              <option value="hash">Hash (por colunas)</option>
              <option value="randomly">Randomly (round-robin)</option>
              <option value="replicated">Replicated (cópia em todos os segmentos)</option>
            </select>
          </Field>

          {config.distributedBy.type === 'hash' && (
            <Field label="Colunas de Distribuição (DISTRIBUTED BY)">
              <div className="tag-list" style={{ marginBottom: 8 }}>
                {config.distributedBy.columns.map(col => (
                  <span key={col} className="tag">
                    {col}
                    <span className="tag-remove" onClick={() => removeDistCol(col)}>✕</span>
                  </span>
                ))}
                {config.distributedBy.columns.length === 0 && (
                  <span style={{ color: '#475569', fontSize: 11 }}>Nenhuma coluna selecionada</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="prop-input"
                  value={newDistCol}
                  placeholder="coluna"
                  onChange={e => setNewDistCol(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addDistCol()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={addDistCol}>+</button>
              </div>
              <div className="mpp-hint">
                Escolha colunas de alta cardinalidade (ex: user_id, order_id) para distribuição uniforme entre segmentos.
              </div>
            </Field>
          )}

          {config.distributedBy.type === 'replicated' && (
            <div className="mpp-hint mpp-hint-warning">
              REPLICATED copia toda a tabela em cada segmento. Use apenas para tabelas de dimensão pequenas.
            </div>
          )}
        </Section>

        {/* ── Query Execution ─────────────────────────────────── */}
        <Section title="Execução da Query">
          <Field label="Otimizador">
            <select
              className="prop-select"
              value={config.optimizer}
              onChange={e => patch({ optimizer: e.target.value as MPPConfig['optimizer'] })}
            >
              <option value="gporca">GPORCA (Orca — recomendado)</option>
              <option value="legacy">Legacy (Planner clássico)</option>
            </select>
            <div className="mpp-hint">
              GPORCA é o otimizador padrão do Greenplum 6+. Use Legacy apenas para queries não suportadas pelo Orca.
            </div>
          </Field>

          <Field label="Resource Queue">
            <input
              className="prop-input"
              value={config.resourceQueue}
              placeholder="pg_default"
              onChange={e => patch({ resourceQueue: e.target.value })}
            />
            <div className="mpp-hint">
              Fila de recursos para controle de concorrência e memória (SET RESOURCE QUEUE).
            </div>
          </Field>

          <Field label="Statement Memory">
            <input
              className="prop-input"
              value={config.statementMemory}
              placeholder="ex: 512MB, 1GB (vazio = padrão)"
              onChange={e => patch({ statementMemory: e.target.value })}
            />
            <div className="mpp-hint">
              Memória máxima por segmento para esta query (statement_mem).
            </div>
          </Field>

          <Field label="Paralelismo (segmentos)">
            <input
              className="prop-input"
              type="number"
              min={1}
              value={config.parallelism ?? ''}
              placeholder="Padrão do cluster"
              onChange={e => patch({ parallelism: e.target.value ? parseInt(e.target.value, 10) : null })}
            />
            <div className="mpp-hint">
              Número de segmentos primários a utilizar. Vazio = usar todos os segmentos disponíveis.
            </div>
          </Field>
        </Section>

        {/* ── Storage (hints for CTAS) ────────────────────────── */}
        <Section title="Armazenamento (CTAS hints)">
          <div className="mpp-hint mpp-hint-info" style={{ marginBottom: 12 }}>
            Estes parâmetros são utilizados quando o backend gerar um CREATE TABLE AS SELECT.
          </div>

          <Field label="Orientação">
            <div style={{ display: 'flex', gap: 6 }}>
              {(['row', 'column'] as const).map(opt => (
                <button
                  key={opt}
                  className={`mpp-toggle-btn${config.orientation === opt ? ' active' : ''}`}
                  onClick={() => patch({ orientation: opt })}
                >
                  {opt === 'row' ? '▦ Row' : '▥ Column'}
                </button>
              ))}
            </div>
            <div className="mpp-hint">
              Column store (AO/CO) é ideal para analytics com muitas colunas; Row para OLTP.
            </div>
          </Field>

          <Field label="Append-Only">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="ao-check"
                checked={config.appendOnly}
                onChange={e => patch({ appendOnly: e.target.checked })}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="ao-check" style={{ color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                Ativar (APPENDONLY = TRUE)
              </label>
            </div>
          </Field>

          <Field label="Compressão">
            <select
              className="prop-select"
              value={config.compressType}
              onChange={e => patch({ compressType: e.target.value as MPPConfig['compressType'] })}
            >
              <option value="none">Sem compressão</option>
              <option value="ZLIB">ZLIB</option>
              <option value="ZSTD">ZSTD (recomendado)</option>
              <option value="QUICKLZ">QUICKLZ</option>
              <option value="RLE_TYPE">RLE_TYPE (colunar)</option>
            </select>
          </Field>

          {config.compressType !== 'none' && (
            <Field label={`Nível de Compressão (1–9): ${config.compressLevel}`}>
              <input
                type="range"
                min={1}
                max={9}
                value={config.compressLevel}
                onChange={e => patch({ compressLevel: parseInt(e.target.value, 10) })}
                style={{ width: '100%', accentColor: '#3b82f6' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: 10 }}>
                <span>Rápido</span>
                <span>Máximo</span>
              </div>
            </Field>
          )}
        </Section>

      </div>
    </div>
  )
}
