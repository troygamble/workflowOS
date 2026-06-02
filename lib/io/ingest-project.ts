import JSZip from "jszip";
import { parse as parseYaml } from "yaml";
import { applyAutoLayout } from "@/lib/graph/auto-layout";
import { syncSkillContractsFromGraph } from "@/lib/graph/edge-helpers";
import type {
  ArtifactNodeData,
  SkillNodeData,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IngestionReport = {
  workflowName: string;
  skillsFound: { fileName: string; name: string; inputs: string[]; outputs: string[] }[];
  artifactsInferred: { fileName: string; artifactType: string; producers: string[]; consumers: string[] }[];
  implementationFiles: { scriptPath: string; linkedSkill: string }[];
  unlinkedFiles: { path: string; ext: string }[];
  warnings: string[];
  /** Whether a graph.json was found and used (existing workflow package) */
  usedExistingGraph: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uid = () => crypto.randomUUID().slice(0, 8);

const SCRIPT_EXTENSIONS = new Set([
  "py", "js", "ts", "sh", "bash", "rb", "go", "rs", "java", "php",
]);

const ARTIFACT_EXTENSIONS: Record<string, "md" | "json" | "yaml" | "csv" | "xlsx" | "txt" | "other"> = {
  md: "md", markdown: "md",
  json: "json",
  yaml: "yaml", yml: "yaml",
  csv: "csv",
  xlsx: "xlsx", xls: "xlsx",
  txt: "txt",
};

function ext(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

function stemName(path: string): string {
  const b = baseName(path);
  const dot = b.lastIndexOf(".");
  return dot > 0 ? b.slice(0, dot) : b;
}

// Raw shape we expect from a skill YAML
type RawSkillYaml = {
  name?: string;
  description?: string;
  fileName?: string;
  inputs?: string[];
  outputs?: string[];
  requires?: string[];
  produces?: string[];
  validations?: string[];
  tags?: string[];
  category?: string;
  enabled?: boolean;
  version?: number;
  notes?: string;
};

function looksLikeSkill(parsed: unknown): parsed is RawSkillYaml {
  if (typeof parsed !== "object" || parsed === null) return false;
  const p = parsed as Record<string, unknown>;
  return (
    typeof p.name === "string" &&
    (Array.isArray(p.inputs) || Array.isArray(p.outputs))
  );
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

// ---------------------------------------------------------------------------
// Main ingestion entry point
// ---------------------------------------------------------------------------

export async function ingestProjectZip(
  file: File
): Promise<{ workflow: Workflow; report: IngestionReport }> {
  const zip = await JSZip.loadAsync(file);

  // ---- Collect all file paths ----
  const allPaths: string[] = [];
  zip.forEach((path) => {
    if (!path.endsWith("/")) allPaths.push(path);
  });

  const warnings: string[] = [];
  const workflowName = stemName(file.name) || "Imported Project";

  // ---- Parse YAML files as potential skills ----
  const skillsByFileName = new Map<
    string,
    { raw: RawSkillYaml; path: string }
  >();

  for (const path of allPaths) {
    const e = ext(path);
    if (e !== "yaml" && e !== "yml") continue;
    // Skip known non-skill YAMLs
    const b = baseName(path);
    if (b === "manifest.yaml" || b === "docker-compose.yml" || b === "docker-compose.yaml") continue;

    try {
      const text = await zip.file(path)!.async("string");
      const parsed = parseYaml(text) as unknown;
      if (looksLikeSkill(parsed)) {
        const inferredFileName = parsed.fileName ?? b;
        skillsByFileName.set(inferredFileName, { raw: parsed, path });
      }
    } catch {
      warnings.push(`Could not parse YAML: ${path}`);
    }
  }

  // ---- Collect all artifact filenames mentioned in skill contracts ----
  const artifactFileNames = new Set<string>();
  for (const { raw } of skillsByFileName.values()) {
    for (const f of toStringArray(raw.inputs)) artifactFileNames.add(f);
    for (const f of toStringArray(raw.outputs)) artifactFileNames.add(f);
  }

  // Also pick up any artifact files directly present in the zip
  for (const path of allPaths) {
    const e = ext(path);
    if (e in ARTIFACT_EXTENSIONS) {
      artifactFileNames.add(baseName(path));
    }
  }

  // ---- Find implementation (script) files ----
  // Strategy: for skill fileName "create_task_list.yaml", look for
  // any script file whose stem matches "create_task_list"
  const skillStems = new Map<string, string>(); // stem -> skillFileName
  for (const [skillFileName] of skillsByFileName) {
    skillStems.set(stemName(skillFileName), skillFileName);
  }

  const implementationFiles: IngestionReport["implementationFiles"] = [];
  const linkedScriptPaths = new Set<string>();

  for (const path of allPaths) {
    const e = ext(path);
    if (!SCRIPT_EXTENSIONS.has(e)) continue;
    const stem = stemName(path);
    const matchedSkill = skillStems.get(stem);
    if (matchedSkill) {
      implementationFiles.push({ scriptPath: path, linkedSkill: matchedSkill });
      linkedScriptPaths.add(path);
    }
  }

  // ---- Build unlinked files list ----
  const mappedPaths = new Set<string>([
    ...[...skillsByFileName.values()].map((v) => v.path),
    ...linkedScriptPaths,
  ]);
  // Also mark artifact files as mapped if they appear directly in the zip
  const artifactPathsInZip = new Set<string>();
  for (const path of allPaths) {
    if (artifactFileNames.has(baseName(path))) {
      artifactPathsInZip.add(path);
    }
  }

  const unlinkedFiles: IngestionReport["unlinkedFiles"] = [];
  const IGNORE_FILES = new Set([
    "package.json", "package-lock.json", "tsconfig.json",
    "requirements.txt", "pyproject.toml", "setup.py",
    ".gitignore", ".env", ".env.example", "README.md", "readme.md",
    "Makefile", "makefile",
  ]);
  for (const path of allPaths) {
    const b = baseName(path);
    if (mappedPaths.has(path)) continue;
    if (artifactPathsInZip.has(path)) continue;
    if (IGNORE_FILES.has(b)) continue;
    if (b.startsWith(".")) continue;
    unlinkedFiles.push({ path, ext: ext(path) });
  }

  // ---- Build nodes ----
  const now = new Date().toISOString();
  const nodes: WorkflowNode[] = [];

  // Skill nodes
  const skillNodeIds = new Map<string, string>(); // skillFileName -> nodeId
  for (const [skillFileName, { raw, path: _p }] of skillsByFileName) {
    const id = `skill_${uid()}`;
    skillNodeIds.set(skillFileName, id);

    // Find linked implementation file
    const implFile = implementationFiles.find((f) => f.linkedSkill === skillFileName);

    const data: SkillNodeData = {
      name: raw.name ?? stemName(skillFileName),
      description: raw.description,
      fileName: skillFileName,
      inputs: toStringArray(raw.inputs),
      outputs: toStringArray(raw.outputs),
      requires: toStringArray(raw.requires),
      produces: toStringArray(raw.produces),
      validations: toStringArray(raw.validations),
      tags: toStringArray(raw.tags),
      category: raw.category,
      enabled: raw.enabled ?? true,
      version: typeof raw.version === "number" ? raw.version : 1,
      notes: raw.notes,
      implementationFile: implFile?.scriptPath,
    };

    nodes.push({ id, type: "skill", position: { x: 0, y: 0 }, data });
  }

  // Artifact nodes — de-duped by fileName
  const artifactNodeIds = new Map<string, string>(); // fileName -> nodeId
  for (const fileName of artifactFileNames) {
    const e = ext(fileName);
    const artifactType = ARTIFACT_EXTENSIONS[e] ?? "other";
    const id = `artifact_${uid()}`;
    artifactNodeIds.set(fileName, id);

    const data: ArtifactNodeData = {
      name: fileName,
      fileName,
      artifactType,
      status: "unknown",
    };

    nodes.push({ id, type: "artifact", position: { x: 0, y: 0 }, data });
  }

  // ---- Build edges ----
  const edges: WorkflowEdge[] = [];
  const edgeKey = (src: string, tgt: string) => `${src}--${tgt}`;
  const seenEdges = new Set<string>();

  for (const [skillFileName, { raw }] of skillsByFileName) {
    const skillId = skillNodeIds.get(skillFileName);
    if (!skillId) continue;

    for (const inputFile of toStringArray(raw.inputs)) {
      const artifactId = artifactNodeIds.get(inputFile);
      if (!artifactId) continue;
      const k = edgeKey(artifactId, skillId);
      if (!seenEdges.has(k)) {
        seenEdges.add(k);
        edges.push({
          id: `e_${uid()}`,
          source: artifactId,
          target: skillId,
          edgeType: "input",
        });
      }
    }

    for (const outputFile of toStringArray(raw.outputs)) {
      const artifactId = artifactNodeIds.get(outputFile);
      if (!artifactId) continue;
      const k = edgeKey(skillId, artifactId);
      if (!seenEdges.has(k)) {
        seenEdges.add(k);
        edges.push({
          id: `e_${uid()}`,
          source: skillId,
          target: artifactId,
          edgeType: "output",
        });
      }
    }
  }

  // ---- Build workflow ----
  let workflow: Workflow = {
    id: uid(),
    name: workflowName,
    version: "1.0.0",
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    metadata: { graphVersion: "1.0.0" },
  };

  // Auto-layout + contract sync
  workflow = applyAutoLayout(syncSkillContractsFromGraph(workflow));

  // ---- Build report ----
  const report: IngestionReport = {
    workflowName,
    skillsFound: [...skillsByFileName.entries()].map(([fn, { raw }]) => ({
      fileName: fn,
      name: raw.name ?? stemName(fn),
      inputs: toStringArray(raw.inputs),
      outputs: toStringArray(raw.outputs),
    })),
    artifactsInferred: [...artifactNodeIds.keys()].map((fn) => {
      const producers = [...skillsByFileName.entries()]
        .filter(([, { raw }]) => toStringArray(raw.outputs).includes(fn))
        .map(([, { raw }]) => raw.name ?? fn);
      const consumers = [...skillsByFileName.entries()]
        .filter(([, { raw }]) => toStringArray(raw.inputs).includes(fn))
        .map(([, { raw }]) => raw.name ?? fn);
      return { fileName: fn, artifactType: ARTIFACT_EXTENSIONS[ext(fn)] ?? "other", producers, consumers };
    }),
    implementationFiles,
    unlinkedFiles,
    warnings,
    usedExistingGraph: false,
  };

  // Warn about artifacts with no producer
  for (const a of report.artifactsInferred) {
    if (a.producers.length === 0 && a.consumers.length > 0) {
      warnings.push(`Artifact "${a.fileName}" has no producer skill — it may be an external input or missing a skill.`);
    }
    if (a.producers.length === 0 && a.consumers.length === 0) {
      warnings.push(`Artifact "${a.fileName}" has no producer or consumer — orphaned reference.`);
    }
  }

  return { workflow, report };
}
