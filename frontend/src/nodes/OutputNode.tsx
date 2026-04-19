import { useMemo, useState, useCallback } from 'react'
import { Handle, Position, useNodes, useEdges } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { OutputNodeData, AppNode } from '../types'
import { useMPP } from '../context/MPPContext'
import { useMetadata } from '../context/MetadataContext'
import { generateAST } from '../utils/astGenerator'
import { executeQuery } from '../services/queryService'
import type { QueryResult } from '../services/queryService'

type OutputNode = Node<OutputNodeData, 'output'>

export default function OutputNode({ id, selected }: NodeProps<OutputNode>) {
  const nodes = useNodes() as AppNode[]
  const edges = useEdges()
  const { config: mpp } = useMPP()
  const { connectionId, status } = useMetadata()

  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [tab, setTab] = useState<'ast' | 'sql' | 'result'>('ast')

  const ast = useMemo(
    () => generateAST(nodes, edges, id, mpp),
    [nodes, edges, id, mpp],
  )

  const jsonPreview = ast
    ? JSON.stringify(ast, null, 2)
    : '// Conecte nós ao Output para gerar o AST'

  const canExecute = ast !== null && status === 'connected' && connectionId !== null

  const run = useCallback(async () => {
    if (!ast || !connectionId) return
    setRunning(true)
    setError(null)
    try {
      const res = await executeQuery(ast, connectionId)
      setResult(res)
      setTab('result')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }, [ast, connectionId])

  return (
    <div className={`sql-node output-node${selected ? ' selected' : ''}`} style={{ minWidth: 340 }}>
      <Handle type="target" position={Position.Left} id="input" />

      {/* Header */}
      <div className="sql-node-header" style={{ background: '#1e3050', gap: 6 }}>
        <span className="sql-node-icon">📤</span>
        <span className="sql-node-title">Output</span>
        {ast && <span className="output-badge">genquery/v1</span>}
        <button
          className={`output-run-btn${running ? ' running' : ''}${!canExecute ? ' disabled' : ''}`}
          onClick={run}
          disabled={!canExecute || running}
          title={!canExecute ? 'Conecte ao banco e complete o fluxo para executar' : 'Executar query'}
        >
          {running ? '⏳' : '▶ Executar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="output-tabs">
        {(['ast', 'sql', 'result'] as const).map(t => (
          <button
            key={t}
            className={`output-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'ast' ? 'AST JSON' : t === 'sql' ? 'SQL' : `Resultado${result ? ` (${result.row_count})` : ''}`}
          </button>
        ))}
      </div>

      <div className="sql-node-body" style={{ padding: 0 }}>
        {/* AST tab */}
        {tab === 'ast' && (
          <div className="ast-preview">{jsonPreview}</div>
        )}

        {/* SQL tab */}
        {tab === 'sql' && (
          <div className="ast-preview">
            {result ? result.generated_sql : '// Execute a query para ver o SQL gerado'}
          </div>
        )}

        {/* Result tab */}
        {tab === 'result' && (
          <div>
            {error && (
              <div className="output-error">{error}</div>
            )}
            {result && !error && (
              <>
                <div className="output-meta">
                  {result.row_count} linhas · {result.execution_time_ms.toFixed(1)} ms
                </div>
                <div className="result-table-wrapper">
                  <table className="result-table">
                    <thead>
                      <tr>
                        {result.columns.map(c => (
                          <th key={c.name} title={c.type}>{c.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j}>{cell === null ? <span className="null-val">NULL</span> : String(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {!result && !error && (
              <div style={{ color: '#475569', fontSize: 12, padding: 12 }}>
                Clique em ▶ Executar para rodar a query
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
