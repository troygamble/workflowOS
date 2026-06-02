import { z } from "zod";

export const generationRequestSchema = z.object({
  goal: z.string().min(10),
  mode: z.enum(["draft", "proposals"]).default("proposals"),
  domain: z.string().optional(),
  complexity: z.enum(["small", "medium", "large"]),
});

const generatedSkillSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  requires: z.array(z.string()).default([]),
  produces: z.array(z.string()).default([]),
  validations: z.array(z.string()).default([]),
});

const generatedArtifactSchema = z.object({
  fileName: z.string().min(3),
  description: z.string().optional(),
  artifactType: z.enum(["md", "json", "yaml", "csv", "xlsx", "txt", "other"]).default("md"),
});

export const generationResponseSchema = z.object({
  summary: z.string(),
  skills: z.array(generatedSkillSchema).default([]),
  artifacts: z.array(generatedArtifactSchema).default([]),
  contractChanges: z
    .array(
      z.object({
        stepName: z.string(),
        requires: z.array(z.string()).optional(),
        produces: z.array(z.string()).optional(),
        validations: z.array(z.string()).optional(),
      }),
    )
    .default([]),
});

export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type GenerationResponse = z.infer<typeof generationResponseSchema>;
