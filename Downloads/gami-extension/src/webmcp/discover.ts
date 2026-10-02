import { WebMcpToolSchema, type WebMcpTool } from './schema';

export type DiscoveredTool = WebMcpTool & { allowed: boolean };

/**
 * V1 is discovery only: tools a site declares are validated and listed.
 * Nothing is executed. Transaction and sensitive tools are never offered to
 * NOVA, and a tool that claims a low risk level without confirmation for an
 * interaction is forced to require confirmation.
 */
export function discoverWebMcpTools(raw: unknown): DiscoveredTool[] {
  if (!Array.isArray(raw)) return [];
  const out: DiscoveredTool[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, 32)) {
    const parsed = WebMcpToolSchema.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.name)) continue;
    seen.add(parsed.data.name);
    const tool = parsed.data;
    const allowed = tool.riskLevel === 'read' || tool.riskLevel === 'interaction';
    out.push({ ...tool, requiresConfirmation: tool.riskLevel === 'read' ? tool.requiresConfirmation : true, allowed });
  }
  return out;
}
