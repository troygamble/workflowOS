import { z } from "zod";

/**
 * Sufficient for import round-trip: structural keys + flexible node/edge body.
 * Domain-specific invariants are enforced in `validateWorkflow`, not only Zod.
 */
export const workflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(z.unknown()).min(0),
  edges: z.array(z.unknown()).min(0),
  metadata: z
    .object({
      graphVersion: z.string(),
      exportedAt: z.string().optional(),
      runtimeSource: z.string().optional(),
    })
    .passthrough()
    .default({ graphVersion: "1.0.0" }),
});
