import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { journalDir } from "../storage/paths.js";
import { todayISO } from "../storage/fs-utils.js";
import { listAllProjects } from "../storage/project.js";
import { listJournalFiles, readJournalFile } from "../helpers/journal-files.js";

export function register(server: McpServer): void {
  // Resource: project index
  server.registerResource(
    "Journal Index",
    new ResourceTemplate("agent-recall://{project}/index", {
      list: async () => {
        const projects = listAllProjects();
        return {
          resources: projects.map((p) => ({
            uri: `agent-recall://${p.slug}/index`,
            name: `${p.slug} — Journal Index`,
            mimeType: "text/markdown",
          })),
        };
      },
    }),
    { description: "Journal index for a project", mimeType: "text/markdown" },
    async (uri, { project }) => {
      const slug = Array.isArray(project) ? project[0] : (project || "unknown");
      const indexPath = path.join(journalDir(slug), "index.md");
      let content = "";
      if (fs.existsSync(indexPath)) {
        content = fs.readFileSync(indexPath, "utf-8");
      } else {
        content = `# ${slug} — No journal index found\n`;
      }
      return {
        contents: [{
          uri: uri.href,
          text: content,
          mimeType: "text/markdown",
        }],
      };
    }
  );

  // Resource: specific date entry
  server.registerResource(
    "Journal Entry",
    new ResourceTemplate("agent-recall://{project}/{date}", {
      list: async () => {
        const projects = listAllProjects();
        const resources: Array<{ uri: string; name: string; mimeType: string }> = [];
        for (const p of projects) {
          const entries = listJournalFiles(p.slug).slice(0, 5);
          for (const e of entries) {
            resources.push({
              uri: `agent-recall://${p.slug}/${e.date}`,
              name: `${p.slug} — ${e.date}`,
              mimeType: "text/markdown",
            });
          }
        }
        return { resources };
      },
    }),
    {
      description: "A specific journal entry by date",
      mimeType: "text/markdown",
    },
    async (uri, { project, date }) => {
      const slug = Array.isArray(project) ? project[0] : (project || "unknown");
      const entryDate = Array.isArray(date) ? date[0] : (date || todayISO());
      const content = readJournalFile(slug, entryDate);
      return {
        contents: [{
          uri: uri.href,
          text: content || `# No entry for ${entryDate}\n`,
          mimeType: "text/markdown",
        }],
      };
    }
  );
}
