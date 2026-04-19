import type { Edge } from '@xyflow/react'
import type {
  AppNode,
  TableNodeData, SelectNodeData, JoinNodeData, FilterNodeData, GroupByNodeData, OrderByNodeData,
  MPPConfig, QueryAST, ColumnExprAST, TableRefAST, JoinAST, ConditionAST,
} from '../types'

// ─── Traversal state accumulated bottom-up through the graph ─────────────────
interface ASTState {
  selectColumns: ColumnExprAST[]
  distinct: boolean
  from: TableRefAST | null
  joins: JoinAST[]
  conditions: ConditionAST[]
  groupByColumns: string[]
  aggregations: Array<{ expression: string; alias?: string }>
  having: string
  orderBy: Array<{ expression: string; direction: 'ASC' | 'DESC' }>
  limit: number | null
}

const EMPTY_STATE: ASTState = {
  selectColumns: [],
  distinct: false,
  from: null,
  joins: [],
  conditions: [],
  groupByColumns: [],
  aggregations: [],
  having: '',
  orderBy: [],
  limit: null,
}

// ─── Helpers ──────────────────────────────────────────────────
function buildReverseEdgeMap(edges: Edge[]): Map<string, { sourceId: string; targetHandle?: string | null }[]> {
  const map = new Map<string, { sourceId: string; targetHandle?: string | null }[]>()
  for (const edge of edges) {
    const sources = map.get(edge.target) ?? []
    sources.push({ sourceId: edge.source, targetHandle: edge.targetHandle })
    map.set(edge.target, sources)
  }
  return map
}

function buildNodeMap(nodes: AppNode[]): Map<string, AppNode> {
  return new Map(nodes.map(n => [n.id, n]))
}

// ─── Graph traversal ──────────────────────────────────────────
function traverse(
  nodeId: string,
  nodeMap: Map<string, AppNode>,
  reverseEdges: Map<string, { sourceId: string; targetHandle?: string | null }[]>,
  visited: Set<string>,
): ASTState {
  if (visited.has(nodeId)) return { ...EMPTY_STATE }
  visited.add(nodeId)

  const node = nodeMap.get(nodeId)
  if (!node) return { ...EMPTY_STATE }

  const sources = reverseEdges.get(nodeId) ?? []

  // ── Table: leaf node, produces the FROM reference ───────────
  if (node.type === 'table') {
    const d = node.data as TableNodeData
    const alias = d.alias || (d.tableName || 't').charAt(0)
    const from: TableRefAST = {
      ...(d.schema ? { schema: d.schema } : {}),
      name: d.tableName || 'table_name',
      alias,
    }
    const cols: ColumnExprAST[] = d.columns?.length > 0
      ? d.columns.map(c => ({ expression: `${alias}.${c}` }))
      : [{ expression: `${alias}.*` }]
    return { ...EMPTY_STATE, from, selectColumns: cols }
  }

  // ── Join: two inputs (left/right handles) ────────────────────
  if (node.type === 'join') {
    const d = node.data as JoinNodeData
    const leftSrc = sources.find(s => s.targetHandle === 'input-left') ?? sources[0]
    const rightSrc = sources.find(s => s.targetHandle === 'input-right') ?? sources[1]

    const left = leftSrc ? traverse(leftSrc.sourceId, nodeMap, reverseEdges, new Set(visited)) : { ...EMPTY_STATE }
    const right = rightSrc ? traverse(rightSrc.sourceId, nodeMap, reverseEdges, new Set(visited)) : null

    const joinNode: JoinAST = {
      type: d.joinType ?? 'INNER',
      right: right?.from ?? { name: '/* right table */' },
      on: d.condition || '/* join condition */',
    }

    return {
      ...left,
      selectColumns: [{ expression: '*' }],
      joins: [...left.joins, joinNode],
      conditions: [...left.conditions, ...(right?.conditions ?? [])],
    }
  }

  // ── All other nodes: single upstream input ───────────────────
  const upstream = sources[0]
    ? traverse(sources[0].sourceId, nodeMap, reverseEdges, new Set(visited))
    : { ...EMPTY_STATE }

  if (node.type === 'select') {
    const d = node.data as SelectNodeData
    const cols: ColumnExprAST[] = d.columns?.length > 0
      ? d.columns.map(c => ({ expression: c.name, ...(c.alias ? { alias: c.alias } : {}) }))
      : upstream.selectColumns
    return { ...upstream, selectColumns: cols, distinct: d.distinct ?? false }
  }

  if (node.type === 'filter') {
    const d = node.data as FilterNodeData
    const newConditions: ConditionAST[] = (d.conditions ?? []).map((c, i) => ({
      column: c.column,
      operator: c.operator || '=',
      ...(['IS NULL', 'IS NOT NULL'].includes(c.operator) ? {} : { value: c.value }),
      ...(i > 0 ? { logic: c.logic } : {}),
    }))
    return { ...upstream, conditions: [...upstream.conditions, ...newConditions] }
  }

  if (node.type === 'groupBy') {
    const d = node.data as GroupByNodeData
    const aggs = (d.aggregations ?? []).map(a => {
      const expr = a.func === 'COUNT DISTINCT'
        ? `COUNT(DISTINCT ${a.column})`
        : `${a.func}(${a.column})`
      return { expression: expr, ...(a.alias ? { alias: a.alias } : {}) }
    })
    const groupCols = d.columns ?? []
    const selectCols: ColumnExprAST[] = [
      ...groupCols.map(c => ({ expression: c })),
      ...aggs,
    ]
    return {
      ...upstream,
      selectColumns: selectCols.length > 0 ? selectCols : upstream.selectColumns,
      groupByColumns: groupCols,
      aggregations: aggs,
      having: d.having || '',
    }
  }

  if (node.type === 'orderBy') {
    const d = node.data as OrderByNodeData
    const orderBy = (d.orderColumns ?? []).map(c => ({ expression: c.column, direction: c.direction }))
    const limit = d.limit ? parseInt(d.limit, 10) : null
    return { ...upstream, orderBy, limit }
  }

  return upstream
}

// ─── Public API ───────────────────────────────────────────────
export function generateAST(
  nodes: AppNode[],
  edges: Edge[],
  outputNodeId: string,
  mpp: MPPConfig,
): QueryAST | null {
  const nodeMap = buildNodeMap(nodes)
  const reverseEdges = buildReverseEdgeMap(edges)

  const sources = reverseEdges.get(outputNodeId) ?? []
  if (sources.length === 0) return null

  const state = traverse(sources[0].sourceId, nodeMap, reverseEdges, new Set())

  return {
    $schema: 'genquery/v1',
    type: 'SELECT',
    mpp,
    select: {
      distinct: state.distinct,
      columns: state.selectColumns.length > 0 ? state.selectColumns : [{ expression: '*' }],
    },
    from: state.from,
    joins: state.joins,
    where: state.conditions.length > 0 ? state.conditions : null,
    groupBy: state.groupByColumns.length > 0 || state.aggregations.length > 0
      ? {
          columns: state.groupByColumns,
          aggregations: state.aggregations,
          ...(state.having ? { having: state.having } : {}),
        }
      : null,
    orderBy: state.orderBy,
    limit: state.limit,
  }
}
