import { useState } from 'react'
import type { JoinNodeData } from '../../types'
import { Field, UpstreamColSelect } from './shared'

export function JoinProperties({
  data,
  onUpdate,
  upstreamCols,
}: {
  data: JoinNodeData
  onUpdate: (d: Partial<JoinNodeData>) => void
  upstreamCols: string[]
}) {
  const condMatch = data.condition?.match(/^(\S+)\s*(=|!=|<>|<|>|<=|>=)\s*(\S+)$/)
  const [leftCol, setLeftCol] = useState(condMatch?.[1] ?? '')
  const [op, setOp] = useState(condMatch?.[2] ?? '=')
  const [rightCol, setRightCol] = useState(condMatch?.[3] ?? '')

  function buildCondition(l: string, o: string, r: string) {
    if (l && r) onUpdate({ condition: `${l} ${o} ${r}` })
  }

  return (
    <div>
      <Field label="Tipo de Join">
        <select
          className="prop-select"
          value={data.joinType || 'INNER'}
          onChange={e => onUpdate({ joinType: e.target.value as JoinNodeData['joinType'] })}
        >
          <option value="INNER">INNER JOIN</option>
          <option value="LEFT">LEFT JOIN</option>
          <option value="RIGHT">RIGHT JOIN</option>
          <option value="FULL OUTER">FULL OUTER JOIN</option>
          <option value="CROSS">CROSS JOIN</option>
        </select>
      </Field>

      <Field label="Condição (ON)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 4, marginBottom: 6 }}>
          <UpstreamColSelect
            value={leftCol}
            upstreamCols={upstreamCols}
            onChange={v => { setLeftCol(v); buildCondition(v, op, rightCol) }}
            placeholder="col esquerda"
          />
          <select
            className="prop-select"
            value={op}
            onChange={e => { setOp(e.target.value); buildCondition(leftCol, e.target.value, rightCol) }}
            style={{ width: 60 }}
          >
            {['=', '!=', '<', '>', '<=', '>='].map(o => <option key={o}>{o}</option>)}
          </select>
          <UpstreamColSelect
            value={rightCol}
            upstreamCols={upstreamCols}
            onChange={v => { setRightCol(v); buildCondition(leftCol, op, v) }}
            placeholder="col direita"
          />
        </div>
        {data.condition && (
          <div style={{
            background: '#0a0f1e', borderRadius: 6, padding: '6px 10px',
            fontFamily: 'monospace', fontSize: 12, color: '#7dd3fc',
          }}>
            ON {data.condition}
          </div>
        )}
        <div className="mpp-hint" style={{ marginTop: 6 }}>
          ⬅ Handle superior: tabela esquerda &nbsp;·&nbsp; ⬅ Handle inferior: tabela direita
        </div>
      </Field>
    </div>
  )
}
