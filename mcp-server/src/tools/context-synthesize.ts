import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProject } from "../storage/project.js";
import { journalDir, palaceDir } from "../storage/paths.js";
import { ensureDir, todayISO } from "../storage/fs-utils.js";
import { listJournalFiles } from "../helpers/journal-files.js";
import { extractSection } from "../helpers/sections.js";
import { ensurePalaceInitialized, listRooms, roomExists, createRoom } from "../palace/rooms.js";
import { fanOut } from "../palace/fan-out.js";
import { generateFrontmatter } from "../palace/obsidian.js";
import { updatePalaceIndex } from "../palace/index-manager.js";

export function register(server: McpServer): void {
  server.registerTool("context_synthesize", {
    title: "Synthesize Context",
    description:
      "Generate L3 semantic synthesis from recent journals and palace rooms. " +
      "Use consolidate=true to write synthesis results into palace rooms as consolidated memories.",
    inputSchema: {
      entries: z.number().int().default(5).describe("Number of recent entries to analyze"),
      focus: z.enum(["full", "decisions", "blockers", "goals"]).default("full"),
      include_palace: z.boolean().default(true).describe("Include palace room summaries in synthesis"),
      consolidate: z.boolean().default(false).describe("Write synthesis results into palace rooms"),
      project: z.string().default("auto"),
    },
  }, async ({ entries: count, focus, include_palace, consolidate, project }) => {
    const slug = await resolveProject(project);
    const journalEntries = listJournalFiles(slug);

    if (journalEntries.length === 0) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `No entries for '${slug}'` }) }], isError: true };
    }

    const toRead = journalEntries.slice(0, count);
    const data: Array<{ date: string; brief: string | null; decisions: string | null; blockers: string | null; next: string | null; observations: string | null }> = [];

    for (const entry of toRead) {
      const content = fs.readFileSync(path.join(entry.dir, entry.file), "utf-8");
      data.push({
        date: entry.date,
        brief: extractSection(content, "brief"),
        decisions: extractSection(content, "decisions"),
        blockers: extractSection(content, "blockers"),
        next: extractSection(content, "next"),
        observations: extractSection(content, "observations"),
      });
    }

    let syn = `# L3 Synthesis — ${slug}\n`;
    syn += `> ${toRead.length} entries: ${toRead[toRead.length - 1]?.date} → ${toRead[0]?.date}\n\n`;

    // Goal evolution
    if (focus === "full" || focus === "goals") {
      syn += `## Goal Evolution\n\n`;
      for (const e of data) {
        if (e.brief) syn += `**${e.date}**: ${e.brief.split("\n")[0]}\n`;
      }
      syn += "\n";
    }

    // Decisions
    if (focus === "full" || focus === "decisions") {
      syn += `## Decisions\n\n`;
      const allDecisions: string[] = [];
      for (const e of data) {
        if (e.decisions) allDecisions.push(`**${e.date}**:\n${e.decisions}\n`);
      }
      syn += allDecisions.length > 0 ? allDecisions.join("\n") : "(none recorded)\n";

      if (allDecisions.length >= 2) {
        syn += "\n### Potential Contradictions\n\n";
        syn += "Review the decisions above. Flag if:\n";
        syn += "- A decision from an earlier date was reversed without explanation\n";
        syn += "- The same topic has conflicting approaches across dates\n";
        syn += "- A goal stated in one entry differs from another\n\n";
      }
    }

    // Blockers
    if (focus === "full" || focus === "blockers") {
      syn += `## Active Blockers\n\n`;
      const latest = data.find(e => e.blockers);
      syn += latest ? `**${latest.date}**:\n${latest.blockers}\n\n` : "(none)\n\n";

      const oldBlockers = data.filter(e => e.blockers && e !== latest);
      if (oldBlockers.length > 0) {
        syn += "### Recurring Blockers (appeared in older entries too)\n\n";
        for (const ob of oldBlockers.slice(0, 2)) {
          syn += `**${ob.date}**: ${ob.blockers?.split("\n")[0] || ""}\n`;
        }
        syn += "\n";
      }
    }

    // Observations
    if (focus === "full") {
      const obs = data.filter(e => e.observations);
      if (obs.length > 0) {
        syn += `## Patterns from Agent Observations\n\n`;
        for (const o of obs.slice(0, 3)) {
          syn += `**${o.date}**: ${o.observations?.split("\n").slice(0, 2).join(" ") || ""}\n`;
        }
        syn += "\n";
      }
    }

    // Today's alignment
    const alignPath = path.join(journalDir(slug), `${todayISO()}-alignment.md`);
    if (fs.existsSync(alignPath)) {
      const alignContent = fs.readFileSync(alignPath, "utf-8");
      const checks = (alignContent.match(/### .*Alignment/g) || []).length;
      const nudges = (alignContent.match(/### .*Nudge/g) || []).length;
      const low = (alignContent.match(/Confidence: low/g) || []).length;
      if (checks > 0 || nudges > 0) {
        syn += `## Today's Alignment\n\n`;
        syn += `- Alignment checks: ${checks}\n- Nudges: ${nudges}\n- Low confidence: ${low}\n\n`;
      }
    }

    // Palace room summaries
    let palaceRoomCount = 0;
    if (include_palace) {
      try {
        ensurePalaceInitialized(slug);
        const rooms = listRooms(slug);
        if (rooms.length > 0) {
          syn += `## Memory Palace — Room Summaries\n\n`;
          for (const room of rooms.slice(0, 5)) {
            syn += `- **${room.name}** (salience: ${room.salience.toFixed(2)}) — ${room.description}\n`;
            if (room.connections.length > 0) {
              syn += `  Connected to: ${room.connections.join(", ")}\n`;
            }
          }
          syn += "\n";
          palaceRoomCount = rooms.length;
        }
      } catch {
        // Palace not initialized, skip
      }
    }

    // Consolidation: write synthesis into palace rooms
    let consolidated = 0;
    if (consolidate) {
      try {
        ensurePalaceInitialized(slug);
        const pd = palaceDir(slug);
        const date = todayISO();

        // Consolidate decisions → architecture room
        const decisionsData = data.filter(e => e.decisions).map(e => `**${e.date}**: ${e.decisions}`).join("\n");
        if (decisionsData) {
          if (!roomExists(slug, "architecture")) {
            createRoom(slug, "architecture", "Architecture", "Technical decisions and patterns", ["technical"]);
          }
          const decPath = path.join(pd, "rooms", "architecture", "decisions.md");
          ensureDir(path.dirname(decPath));
          const entry = `\n### Consolidated ${date}\n\n${decisionsData}\n`;
          if (fs.existsSync(decPath)) {
            fs.appendFileSync(decPath, entry, "utf-8");
          } else {
            const fm = generateFrontmatter({ room: "architecture", topic: "decisions", created: new Date().toISOString(), source: "consolidation" });
            fs.writeFileSync(decPath, `${fm}# architecture / decisions\n${entry}`, "utf-8");
          }
          fanOut(slug, "architecture", "decisions", decisionsData, ["goals"], "high");
          consolidated++;
        }

        // Consolidate goals → goals room
        const goalsData = data.filter(e => e.brief).map(e => `**${e.date}**: ${e.brief?.split("\n")[0]}`).join("\n");
        if (goalsData) {
          const evoPath = path.join(pd, "rooms", "goals", "evolution.md");
          ensureDir(path.dirname(evoPath));
          const entry = `\n### Consolidated ${date}\n\n${goalsData}\n`;
          if (fs.existsSync(evoPath)) {
            fs.appendFileSync(evoPath, entry, "utf-8");
          } else {
            const fm = generateFrontmatter({ room: "goals", topic: "evolution", created: new Date().toISOString(), source: "consolidation" });
            fs.writeFileSync(evoPath, `${fm}# goals / evolution\n${entry}`, "utf-8");
          }
          consolidated++;
        }

        // Consolidate blockers → blockers room
        const blockersData = data.filter(e => e.blockers).map(e => `**${e.date}**: ${e.blockers?.split("\n")[0]}`).join("\n");
        if (blockersData) {
          const blkPath = path.join(pd, "rooms", "blockers", "history.md");
          ensureDir(path.dirname(blkPath));
          const entry = `\n### Consolidated ${date}\n\n${blockersData}\n`;
          if (fs.existsSync(blkPath)) {
            fs.appendFileSync(blkPath, entry, "utf-8");
          } else {
            const fm = generateFrontmatter({ room: "blockers", topic: "history", created: new Date().toISOString(), source: "consolidation" });
            fs.writeFileSync(blkPath, `${fm}# blockers / history\n${entry}`, "utf-8");
          }
          consolidated++;
        }

        updatePalaceIndex(slug);
      } catch {
        // Consolidation is optional
      }
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        project: slug,
        entries_analyzed: toRead.length,
        palace_rooms: palaceRoomCount,
        consolidated,
        synthesis: syn,
      }) }],
    };
  });
}
