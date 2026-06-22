import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  bootstrapScan,
  bootstrapImport,
  type BootstrapScanResult,
} from "agent-recall-core";

// ---------------------------------------------------------------------------
// GUARD 3 — strict scan_result schema for bootstrap_import
//
// Replaces the previous z.union([z.string(), z.record(z.string(), z.unknown())])
// which accepted any arbitrary object. This schema validates the structural
// shape of a BootstrapScanResult and requires _session_nonce to be present
// as a non-empty string. The nonce is then validated server-side inside
// bootstrapImport() against the in-process VALID_NONCES registry.
//
// Note: _session_nonce presence is checked here; cryptographic validity
// (is it a known nonce?) is checked inside bootstrapImport() — the MCP
// layer enforces structural shape, the core layer enforces security semantics.
// ---------------------------------------------------------------------------
const ImportableItemSchema = z.object({
  id: z.string(),
  type: z.enum(["identity", "memory", "architecture", "trajectory"]),
  source_path: z.string(),
  size_bytes: z.number(),
  preview: z.string(),
});

const DiscoveredProjectSchema = z.object({
  slug: z.string(),
  name: z.string(),
  path: z.string(),
  sources: z.array(z.object({
    type: z.enum(["git", "claude-memory", "claudemd", "package-json"]),
    path: z.string(),
    detail: z.string(),
  })),
  description: z.string().optional(),
  language: z.string().optional(),
  last_activity: z.string().optional(),
  already_in_ar: z.boolean(),
  importable_items: z.array(ImportableItemSchema),
});

const BootstrapScanResultSchema = z.object({
  projects: z.array(DiscoveredProjectSchema),
  global_items: z.array(ImportableItemSchema),
  stats: z.object({
    total_projects: z.number(),
    total_importable_items: z.number(),
    total_already_in_ar: z.number(),
    scan_duration_ms: z.number(),
  }),
  _session_nonce: z.string().min(1, "_session_nonce must be a non-empty string — call bootstrap_scan() first"),
  _scan_roots: z.array(z.string()),
});

export function register(server: McpServer): void {
  server.registerTool("bootstrap_scan", {
    title: "Bootstrap Scan",
    description: "Discover existing projects on this machine — git repos, Claude memory, CLAUDE.md files. Returns what CAN be imported into AgentRecall. Read-only, no writes. Run this first if AgentRecall is empty.",
    inputSchema: {
      scan_dirs: z.array(z.string()).optional().describe("Additional directories to scan (default: ~/Projects/, ~/work/, ~/code/, ~/dev/, ~/src/, ~/repos/, ~/github/)"),
      max_depth: z.number().int().min(1).max(5).optional().describe("Maximum directory depth to scan (default: 3, max: 5)"),
    },
  }, async ({ scan_dirs, max_depth }) => {
    const result = await bootstrapScan({
      scan_dirs: scan_dirs ?? undefined,
      max_depth: max_depth ?? undefined,
    });

    // Format as human-readable text + structured JSON
    const summary = [
      `Found ${result.stats.total_projects} projects (${result.stats.total_already_in_ar} already in AgentRecall, ${result.stats.total_projects - result.stats.total_already_in_ar} new)`,
      `${result.stats.total_importable_items} importable items`,
      `${result.global_items.length} global items (user profile)`,
      `Scan time: ${result.stats.scan_duration_ms}ms`,
      ``,
      `New projects:`,
      ...result.projects
        .filter(p => !p.already_in_ar)
        .slice(0, 15)
        .map(p => `  ${p.slug} — ${p.language ?? "unknown"} — ${p.sources.map(s => s.type).join("+")}`),
      ``,
      `To import: call bootstrap_import`,
    ].join("\n");

    return {
      content: [
        { type: "text" as const, text: summary },
        { type: "text" as const, text: JSON.stringify(result) },
      ],
    };
  });

  server.registerTool("bootstrap_import", {
    title: "Bootstrap Import",
    description: "Import discovered projects into AgentRecall. Call bootstrap_scan FIRST, then pass the EXACT scan_result object returned here — do NOT construct scan_result manually. Security: requires _session_nonce from the scan call; fabricated or replayed scan results are rejected.",
    inputSchema: {
      scan_result: z.union([z.string(), z.record(z.string(), z.unknown())]).describe("BootstrapScanResult from bootstrap_scan — pass the exact object returned by bootstrap_scan, including _session_nonce. Do NOT construct this manually."),
      project_slugs: z.array(z.string()).optional().describe("Import only these projects (default: all new)"),
      item_types: z.array(z.string()).optional().describe("Import only these item types: identity, memory, architecture, trajectory"),
    },
  }, async ({ scan_result, project_slugs, item_types }) => {
    let scan: BootstrapScanResult;
    try {
      // Parse JSON string if needed
      let rawScan: unknown;
      if (typeof scan_result === "string") {
        try {
          rawScan = JSON.parse(scan_result);
        } catch {
          return { content: [{ type: "text" as const, text: "Error: scan_result string is not valid JSON. Pass the exact object from bootstrap_scan." }], isError: true };
        }
      } else {
        rawScan = scan_result;
      }

      // GUARD 3: Strict structural validation — rejects malformed / fabricated objects
      const parsed = BootstrapScanResultSchema.safeParse(rawScan);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0];
        const msg = firstError
          ? `${firstError.path.join(".")}: ${firstError.message}`
          : "scan_result failed schema validation";
        return {
          content: [{ type: "text" as const, text: `Security: scan_result rejected — ${msg}. Pass the exact object returned by bootstrap_scan().` }],
          isError: true,
        };
      }
      scan = parsed.data as BootstrapScanResult;
    } catch {
      return { content: [{ type: "text" as const, text: "Error: scan_result must be valid JSON from bootstrap_scan" }], isError: true };
    }

    const result = await bootstrapImport(scan, {
      project_slugs: project_slugs ?? undefined,
      item_types: item_types ?? undefined,
    });

    if (result.errors.length > 0 && result.items_imported === 0) {
      return {
        content: [{ type: "text" as const, text: `Bootstrap import failed — ${result.errors.length} errors, 0 items imported.\n${result.errors.slice(0, 3).map(e => `  ${e.project}/${e.item}: ${e.error}`).join("\n")}` }],
        isError: true,
      };
    }

    const summary = [
      `Bootstrap import complete:`,
      `  ${result.projects_created} projects created`,
      `  ${result.items_imported} items imported`,
      `  ${result.items_skipped} items skipped`,
      `  ${result.errors.length} errors`,
      `  Duration: ${result.duration_ms}ms`,
      result.errors.length > 0 ? `\nErrors:\n${result.errors.map(e => `  ${e.project}/${e.item}: ${e.error}`).join("\n")}` : "",
      ``,
      `Run session_start to load any imported project.`,
    ].join("\n");

    return { content: [{ type: "text" as const, text: summary }] };
  });
}
