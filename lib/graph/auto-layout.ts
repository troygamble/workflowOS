import type { Workflow } from "@/lib/types/workflow";

const COL_WIDTH = 280;
const ROW_HEIGHT = 160;
const PAD_X = 80;
const PAD_Y = 80;

/**
 * Lay out workflow nodes in a clean left-to-right hierarchical layout.
 *
 * Algorithm:
 *  1. Build a directed adjacency list from non-derived edges.
 *  2. BFS from source nodes (no incoming edges) to assign a column (depth) to
 *     each node — always using the maximum depth seen so inputs always sit to
 *     the left of the skills that consume them.
 *  3. Group nodes by column, assign rows top-to-bottom.
 *  4. Any disconnected nodes land in a column to the right of the deepest node.
 */
export function applyAutoLayout(workflow: Workflow): Workflow {
  const realEdges = workflow.edges.filter((e) => !e.derived);

  // Build adjacency + in-degree maps
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const n of workflow.nodes) {
    inDegree.set(n.id, 0);
    children.set(n.id, []);
  }

  for (const e of realEdges) {
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    const list = children.get(e.source);
    if (list) list.push(e.target);
  }

  // BFS – assign maximum depth (so consumers sit to the right of their inputs)
  const depth = new Map<string, number>();
  const queue: string[] = [];

  for (const n of workflow.nodes) {
    if ((inDegree.get(n.id) ?? 0) === 0) {
      depth.set(n.id, 0);
      queue.push(n.id);
    }
  }

  let qi = 0;
  while (qi < queue.length) {
    const id = queue[qi++];
    const d = depth.get(id) ?? 0;
    for (const cid of children.get(id) ?? []) {
      const prev = depth.get(cid) ?? -1;
      if (d + 1 > prev) {
        depth.set(cid, d + 1);
        // Re-queue to propagate updated depth through the rest of the graph
        queue.push(cid);
      }
    }
  }

  // Place disconnected nodes to the right
  let maxDepth = 0;
  for (const d of depth.values()) maxDepth = Math.max(maxDepth, d);

  for (const n of workflow.nodes) {
    if (!depth.has(n.id)) depth.set(n.id, maxDepth + 1);
  }

  // Group by column
  const byCol = new Map<number, string[]>();
  for (const [id, d] of depth) {
    if (!byCol.has(d)) byCol.set(d, []);
    byCol.get(d)!.push(id);
  }

  // Assign positions
  const positions = new Map<string, { x: number; y: number }>();
  for (const [col, ids] of byCol) {
    ids.forEach((id, row) => {
      positions.set(id, {
        x: PAD_X + col * COL_WIDTH,
        y: PAD_Y + row * ROW_HEIGHT,
      });
    });
  }

  return {
    ...workflow,
    nodes: workflow.nodes.map((n) => ({
      ...n,
      position: positions.get(n.id) ?? n.position,
    })),
  };
}
