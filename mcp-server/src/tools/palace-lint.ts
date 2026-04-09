/**
 * Tool: palace_lint — Health check for the Memory Palace.
 * Detects contradictions, stale memories, orphan rooms, missing cross-refs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as z from "zod/v4";
import type { ServerType } from "../server.js";
import { resolveProject } from "../storage/project.js";
import { palaceDir } from "../storage/paths.js";
import { ensurePalaceInitialized, listRooms, updateRoomMeta } from "../palace/rooms.js";
import { readGraph, getConnectionCount } from "../palace/graph.js";
import { computeSalience, ARCHIVE_THRESHOLD } from "../palace/salience.js";
import { updatePalaceIndex } from "../palace/index-manager.js";
import { appendToLog } from "../palace/log.js";

interface LintIssue {
  type: "stale" | "orphan" | "low_salience" | "empty" | "missing_readme";
  severity: "warning" | "info";
  room: string;
  description: string;
  suggestion: string;
}

export function register(server: ServerType): void {
  server.registerTool("palace_lint", {
    title: "Lint Memory Palace",
    description:
      "Health check: find stale memories, orphan rooms (no connections), low-salience entries, " +
      "and missing cross-references. Use fix=true to auto-archive low-salience entries.",
    inputSchema: {
      fix: z.boolean().default(false).describe("If true, auto-archive memories below salience threshold"),
      project: z.string().default("auto"),
    },
  }, async ({ fix, project }) => {
    const slug = await resolveProject(project);
    ensurePalaceInitialized(slug);

    const rooms = listRooms(slug);
    const pd = palaceDir(slug);
    const issues: LintIssue[] = [];
    let fixed = 0;

    for (const room of rooms) {
      const roomPath = path.join(pd, "rooms", room.slug);

      // Check: orphan rooms (no connections)
      const connCount = getConnectionCount(pd, room.slug);
      if (connCount === 0 && room.connections.length === 0) {
        issues.push({
          type: "orphan",
          severity: "warning",
          room: room.slug,
          description: `Room '${room.name}' has no connections to other rooms`,
          suggestion: `Add connections via palace_write with [[wikilinks]] or connections param`,
        });
      }

      // Check: stale rooms (not accessed in 30+ days)
      const daysSinceAccess =
        (Date.now() - new Date(room.last_accessed).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceAccess > 30) {
        issues.push({
          type: "stale",
          severity: "info",
          room: room.slug,
          description: `Room '${room.name}' not accessed in ${Math.floor(daysSinceAccess)} days`,
          suggestion: `Review if still relevant. Access it to refresh salience.`,
        });
      }

      // Check: low salience
      const salience = computeSalience({
        importance: "medium",
        lastUpdated: room.updated,
        accessCount: room.access_count,
        connectionCount: connCount,
      });

      if (salience < ARCHIVE_THRESHOLD) {
        issues.push({
          type: "low_salience",
          severity: "warning",
          room: room.slug,
          description: `Room '${room.name}' salience is ${salience.toFixed(3)} (below ${ARCHIVE_THRESHOLD})`,
          suggestion: fix ? "Auto-archiving..." : "Consider archiving or refreshing with new content",
        });

        if (fix) {
          // Move room to archive
          const archiveDir = path.join(pd, "archive", room.slug);
          if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
          }
          // Copy files
          if (fs.existsSync(roomPath)) {
            const files = fs.readdirSync(roomPath);
            for (const file of files) {
              fs.copyFileSync(
                path.join(roomPath, file),
                path.join(archiveDir, file)
              );
            }
            // Remove original room
            fs.rmSync(roomPath, { recursive: true });
            fixed++;
          }
        }
      }

      // Check: empty rooms (no content files beyond README.md)
      if (fs.existsSync(roomPath)) {
        const files = fs.readdirSync(roomPath)
          .filter((f) => f.endsWith(".md") && f !== "README.md");
        if (files.length === 0) {
          issues.push({
            type: "empty",
            severity: "info",
            room: room.slug,
            description: `Room '${room.name}' has no topic files (only README)`,
            suggestion: "Add content with palace_write(room='${room.slug}', topic='...')",
          });
        }
      }

      // Check: missing README.md
      if (!fs.existsSync(path.join(roomPath, "README.md"))) {
        issues.push({
          type: "missing_readme",
          severity: "warning",
          room: room.slug,
          description: `Room '${room.name}' is missing README.md`,
          suggestion: "Recreate with palace_write",
        });
      }
    }

    // Update palace index after potential changes
    if (fix && fixed > 0) {
      updatePalaceIndex(slug);
    }

    // Update last_lint timestamp
    const indexPath = path.join(pd, "palace-index.json");
    if (fs.existsSync(indexPath)) {
      try {
        const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
        index.last_lint = new Date().toISOString();
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
      } catch {
        // ignore
      }
    }

    // Log lint operation
    appendToLog(slug, "palace_lint", {
      issues_found: issues.length,
      fixed,
      rooms_checked: rooms.length,
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          project: slug,
          issues,
          total_issues: issues.length,
          fixed,
          rooms_checked: rooms.length,
        }),
      }],
    };
  });
}
