import type { Node } from '@xyflow/react'

// ─── Database metadata ────────────────────────────────────────
export interface ConnectionConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
}

export interface ColumnMeta {
  name: string
  dataType: string
  nullable: boolean
}

export interface TableMeta {
  name: string
  schema: string
  tableType: 'BASE TABLE' | 'VIEW' | 'MATERIALIZED VIEW'
}

export interface Column {
  id: string
  name: string
  alias: string
}

export interface FilterCondition {
  id: string
  column: string
  operator: string
  value: string
  logic: 'AND' | 'OR'
}

export interface Aggregation {
  id: string
  column: string
  func: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT DISTINCT'
  alias: string
}

export interface OrderColumn {
  id: string
  column: string
  direction: 'ASC' | 'DESC'
}

export interface TableNodeData extends Record<string, unknown> {
  label: string
  tableName: string
  schema: string
  alias: string
  columns: string[]
}

export interface SelectNodeData extends Record<string, unknown> {
  label: string
  columns: Column[]
  distinct: boolean
}

export interface JoinNodeData extends Record<string, unknown> {
  label: string
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL OUTER' | 'CROSS'
  condition: string
}

export interface FilterNodeData extends Record<string, unknown> {
  label: string
  conditions: FilterCondition[]
}

export interface GroupByNodeData extends Record<string, unknown> {
  label: string
  columns: string[]
  aggregations: Aggregation[]
  having: string
}

export interface OrderByNodeData extends Record<string, unknown> {
  label: string
  orderColumns: OrderColumn[]
  limit: string
}

export interface OutputNodeData extends Record<string, unknown> {
  label: string
}

export type AppNode =
  | Node<TableNodeData, 'table'>
  | Node<SelectNodeData, 'select'>
  | Node<JoinNodeData, 'join'>
  | Node<FilterNodeData, 'filter'>
  | Node<GroupByNodeData, 'groupBy'>
  | Node<OrderByNodeData, 'orderBy'>
  | Node<OutputNodeData, 'output'>

export type NodeType = AppNode['type']

export const NODE_CATALOG: Array<{
  type: NodeType
  label: string
  description: string
  icon: string
  color: string
}> = [
  { type: 'table', label: 'Table Source', description: 'Tabela de origem', icon: '🗄️', color: '#2563eb' },
  { type: 'select', label: 'Select', description: 'Seleção de colunas', icon: '🔍', color: '#059669' },
  { type: 'join', label: 'Join', description: 'União de tabelas', icon: '🔗', color: '#7c3aed' },
  { type: 'filter', label: 'Filter', description: 'Cláusula WHERE', icon: '🔺', color: '#d97706' },
  { type: 'groupBy', label: 'Group By', description: 'Agrupamento', icon: '📊', color: '#db2777' },
  { type: 'orderBy', label: 'Order By', description: 'Ordenação', icon: '↕️', color: '#0891b2' },
  { type: 'output', label: 'Output', description: 'Resultado final', icon: '📤', color: '#475569' },
]

export const NODE_COLORS: Record<string, string> = {
  table: '#2563eb',
  select: '#059669',
  join: '#7c3aed',
  filter: '#d97706',
  groupBy: '#db2777',
  orderBy: '#0891b2',
  output: '#475569',
}

// ─── MPP / Greenplum Configuration ───────────────────────────
export interface MPPConfig {
  distributedBy: {
    type: 'hash' | 'replicated' | 'randomly'
    columns: string[]
  }
  optimizer: 'gporca' | 'legacy'
  resourceQueue: string
  statementMemory: string
  parallelism: number | null
  appendOnly: boolean
  orientation: 'row' | 'column'
  compressType: 'none' | 'ZLIB' | 'ZSTD' | 'QUICKLZ' | 'RLE_TYPE'
  compressLevel: number
}

export const DEFAULT_MPP_CONFIG: MPPConfig = {
  distributedBy: { type: 'randomly', columns: [] },
  optimizer: 'gporca',
  resourceQueue: 'pg_default',
  statementMemory: '',
  parallelism: null,
  appendOnly: false,
  orientation: 'row',
  compressType: 'none',
  compressLevel: 6,
}

// ─── Query AST ────────────────────────────────────────────────
export interface ColumnExprAST {
  expression: string
  alias?: string
}

export interface TableRefAST {
  schema?: string
  name: string
  alias?: string
}

export interface JoinAST {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL OUTER' | 'CROSS'
  right: TableRefAST
  on: string
}

export interface ConditionAST {
  column: string
  operator: string
  value?: string
  logic?: 'AND' | 'OR'
}

export interface QueryAST {
  $schema: 'genquery/v1'
  type: 'SELECT'
  mpp: MPPConfig
  select: {
    distinct: boolean
    columns: ColumnExprAST[]
  }
  from: TableRefAST | null
  joins: JoinAST[]
  where: ConditionAST[] | null
  groupBy: {
    columns: string[]
    aggregations: Array<{ expression: string; alias?: string }>
    having?: string
  } | null
  orderBy: Array<{ expression: string; direction: 'ASC' | 'DESC' }>
  limit: number | null
}
