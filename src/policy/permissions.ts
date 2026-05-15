import type { ToolRisk } from "../tools/registry.js";

export function requiresConfirmation(risk: ToolRisk): boolean {
  return risk === "write" || risk === "dangerous";
}
