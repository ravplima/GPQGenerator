import type { Edge } from '@xyflow/react'
import type { AppNode, TableNodeData, SelectNodeData, JoinNodeData, FilterNodeData, GroupByNodeData, OrderByNodeData } from '../types'

interface SQLParts {
  select: string[]
  from: string
  joins: string[]
  where: string[]
  groupBy: string[]
  aggregations: string[]
  having: string
  orderBy: string[]
  limit: string
}

function buildReverseEdgeMap(edges: Edge[]): Map<string, { sourceId: string; targetHandle?: string | null }[]> {
  const map = new Map<string, { sourceId: string; targetHandle?: string | null }[]>()
  for (const edge of edges) {
    const sources = map.get(edge.target) || []
    sources.push({ sourceId: edge.source, targetHandle: edge.targetHandle })
    map.set(edge.target, sources)
  }
  return map
}

function buildNodeMap(nodes: AppNode[]): Map<string, AppNode> {
  return new Map(nodes.map(n => [n.id, n]))
}

function traverse(
  nodeId: string,
  nodeMap: Map<string, AppNode>,
  reverseEdges: Map<string, { sourceId: string; targetHandle?: string | null }[]>,
  visited: Set<string>
): SQLParts {
  if (visited.has(nodeId)) {
    return { select: ['*'], from: '/* circular */', joins: [], where: [], groupBy: [], aggregations: [], having: '', orderBy: [], limit: '' }
  }
  visited.add(nodeId)

  const node = nodeMap.get(nodeId)
  if (!node) return { select: ['*'], from: '/* unknown */', joins: [], where: [], groupBy: [], aggregations: [], having: '', orderBy: [], limit: '' }

  const sources = reverseEdges.get(nodeId) || []

  if (node.type === 'table') {
    const data = node.data as TableNodeData
    const schema = data.schema ? `${data.schema}.` : ''
    const tableName = data.tableName || 'table_name'
    const alias = data.alias || tableName.toLowerCase().slice(0, 1)
    const cols = data.columns?.length > 0 ? data.columns.map(c => `${alias}.${c}`) : [`${alias}.*`]
    return {
      select: cols,
      from: `${schema}${tableName} AS ${alias}`,
      joins: [],
      where: [],
      groupBy: [],
      aggregations: [],
      having: '',
      orderBy: [],
      limit: '',
    }
  }

  if (node.type === 'join') {
    const data = node.data as JoinNodeData
    const leftSrc = sources.find(s => s.targetHandle === 'input-left') || sources[0]
    const rightSrc = sources.find(s => s.targetHandle === 'input-right') || sources[1]

    const left = leftSrc ? traverse(leftSrc.sourceId, nodeMap, reverseEdges, new Set(visited)) : null
    const right = rightSrc ? traverse(rightSrc.sourceId, nodeMap, reverseEdges, new Set(visited)) : null

    const joinType = data.joinType || 'INNER'
    const condition = data.condition || '/* join condition */'

    const leftFrom = left?.from || '/* left table */'
    const rightFrom = right?.from || '/* right table */'
    const rightJoin = `${joinType} JOIN ${rightFrom} ON ${condition}`

    return {
      select: ['*'],
      from: leftFrom,
      joins: [...(left?.joins || []), rightJoin],
      where: [...(left?.where || []), ...(right?.where || [])],
      groupBy: [],
      aggregations: [],
      having: '',
      orderBy: [],
      limit: '',
    }
  }

  const upstream = sources[0] ? traverse(sources[0].sourceId, nodeMap, reverseEdges, new Set(visited)) : null
  const base: SQLParts = upstream ?? { select: ['*'], from: '/* no source */', joins: [], where: [], groupBy: [], aggregations: [], having: '', orderBy: [], limit: '' }

  if (node.type === 'select') {
    const data = node.data as SelectNodeData
    const cols = data.columns?.length > 0
      ? data.columns.map(c => c.alias ? `${c.name} AS ${c.alias}` : c.name)
      : base.select
    return { ...base, select: cols }
  }

  if (node.type === 'filter') {
    const data = node.data as FilterNodeData
    const conditions = data.conditions || []
    if (conditions.length === 0) return base
    const parts = conditions.map((c, i) => {
      const op = c.operator || '='
      const val = ['IS NULL', 'IS NOT NULL'].includes(op) ? '' : ` '${c.value}'`
      const prefix = i === 0 ? '' : ` ${c.logic} `
      return `${prefix}${c.column} ${op}${val}`
    })
    return { ...base, where: [...base.where, parts.join('')] }
  }

  if (node.type === 'groupBy') {
    const data = node.data as GroupByNodeData
    const groupCols = data.columns || []
    const aggs = (data.aggregations || []).map(a => {
      const fn = a.func === 'COUNT DISTINCT' ? `COUNT(DISTINCT ${a.column})` : `${a.func}(${a.column})`
      return a.alias ? `${fn} AS ${a.alias}` : fn
    })
    const selectCols = [...groupCols, ...aggs]
    return {
      ...base,
      select: selectCols.length > 0 ? selectCols : base.select,
      groupBy: groupCols,
      aggregations: aggs,
      having: data.having || '',
    }
  }

  if (node.type === 'orderBy') {
    const data = node.data as OrderByNodeData
    const orderCols = (data.orderColumns || []).map(c => `${c.column} ${c.direction}`)
    return {
      ...base,
      orderBy: orderCols,
      limit: data.limit || '',
    }
  }

  return base
}

export function generateSQL(nodes: AppNode[], edges: Edge[], outputNodeId: string): string {
  const nodeMap = buildNodeMap(nodes)
  const reverseEdges = buildReverseEdgeMap(edges)

  const outputNode = nodeMap.get(outputNodeId)
  if (!outputNode) return '-- Conecte nós ao Output para gerar SQL'

  const sources = reverseEdges.get(outputNodeId) || []
  if (sources.length === 0) return '-- Conecte nós ao Output para gerar SQL'

  const parts = traverse(sources[0].sourceId, nodeMap, reverseEdges, new Set())

  const selectClause = parts.select.length > 0 ? parts.select.join(',\n  ') : '*'
  const lines: string[] = []

  lines.push(`SELECT ${selectClause}`)
  lines.push(`FROM ${parts.from}`)

  for (const join of parts.joins) {
    lines.push(join)
  }

  if (parts.where.length > 0) {
    lines.push(`WHERE ${parts.where.join('\n  AND ')}`)
  }

  if (parts.groupBy.length > 0) {
    lines.push(`GROUP BY ${parts.groupBy.join(', ')}`)
  }

  if (parts.having) {
    lines.push(`HAVING ${parts.having}`)
  }

  if (parts.orderBy.length > 0) {
    lines.push(`ORDER BY ${parts.orderBy.join(', ')}`)
  }

  if (parts.limit) {
    lines.push(`LIMIT ${parts.limit}`)
  }

  return lines.join('\n')
}
