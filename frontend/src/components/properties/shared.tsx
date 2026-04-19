import type { ColumnMeta } from '../../types'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="prop-group">
      <label className="prop-label">{label}</label>
      {children}
    </div>
  )
}

export function LoadingSelect({ placeholder }: { placeholder: string }) {
  return (
    <select className="prop-select" disabled>
      <option>{placeholder}</option>
    </select>
  )
}

export function DisconnectedBadge() {
  return (
    <div className="meta-disconnected">
      🔌 Banco não conectado — configure a conexão para selecionar do catálogo
    </div>
  )
}

export function ColumnSelect({
  value,
  columns,
  onChange,
  placeholder = '— selecione uma coluna —',
  style,
}: {
  value: string
  columns: ColumnMeta[]
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) {
  return (
    <select className="prop-select" value={value} onChange={e => onChange(e.target.value)} style={style}>
      <option value="">{placeholder}</option>
      {columns.map(c => (
        <option key={c.name} value={c.name}>
          {c.name} — {c.dataType}
        </option>
      ))}
    </select>
  )
}

export function UpstreamColSelect({
  value,
  upstreamCols,
  onChange,
  placeholder = '— selecione —',
  style,
}: {
  value: string
  upstreamCols: string[]
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) {
  return (
    <select className="prop-select" value={value} onChange={e => onChange(e.target.value)} style={style}>
      <option value="">{placeholder}</option>
      {upstreamCols.map(c => (
        <option key={c} value={c}>{c}</option>
      ))}
      {upstreamCols.length === 0 && (
        <option disabled>Nenhuma tabela conectada</option>
      )}
    </select>
  )
}
