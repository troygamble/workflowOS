import type { RuntimeEvent } from "@/lib/types/runtime";

export function parseEventsLog(content: string): RuntimeEvent[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RuntimeEvent);
}

