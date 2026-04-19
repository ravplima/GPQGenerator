import type { Edge } from '@xyflow/react'
import type { AppNode, TableNodeData } from '../types'

/**
 * Traverses the graph backwards from `nodeId` and collects every column
 * declared on upstream Table nodes, prefixed with the table alias when present.
 */
export function getUpstreamColumns(
  nodeId: string,
  nodes: AppNode[],
  edges: Edge[],
): string[] {
  // targetId → [sourceId, …]
  const reverseEdges = new Map<string, string[]>()
  for (const edge of edges) {
    const list = reverseEdges.get(edge.target) ?? []
    list.push(edge.source)
    reverseEdges.set(edge.target, list)
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const visited = new Set<string>()
  const queue = [...(reverseEdges.get(nodeId) ?? [])]
  const cols: string[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    const node = nodeMap.get(id)
    if (!node) continue

    if (node.type === 'table') {
      const d = node.data as TableNodeData
      const prefix = d.alias ? `${d.alias}.` : ''
      for (const c of d.columns ?? []) cols.push(`${prefix}${c}`)
    }

    queue.push(...(reverseEdges.get(id) ?? []))
  }

  return [...new Set(cols)]
}
