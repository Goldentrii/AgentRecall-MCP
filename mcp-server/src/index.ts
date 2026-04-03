#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERSION = "2.1.5";
const JOURNAL_ROOT =
  process.env.AGENT_RECALL_ROOT ||
  path.join(os.homedir(), ".agent-recall");
const LEGACY_ROOT = path.join(os.homedir(), ".claude", "projects");

const SECTION_HEADERS: Record<string, string> = {
  brief: "## Brief",
  qa: "## Q&A Log",
  completed: "## Completed",
  status: "## Status",
  blockers: "## Blockers",
  next: "## Next",
  decisions: "## Decisions",
  reflection: "## Reflection",
  files: "## Files Changed",
  observations: "## Observations",
};

// ---------------------------------------------------------------------------
// CLI flags (handle before MCP starts)
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(
    `agent-recall-mcp v${VERSION}

Two-layer AI session memory — read, write, and navigate project journals via MCP.

Usage:
  npx agent-recall-mcp            Start the MCP server (stdio transport)
  npx agent-recall-mcp --help     Show this help
  npx agent-recall-mcp --list-tools  List available MCP tools

Storage: ${JOURNAL_ROOT}
Legacy:  ${LEGACY_ROOT}

All data stays local. No cloud, no telemetry.
`
  );
  process.exit(0);
}

if (args.includes("--list-tools")) {
  const tools = [
    { name: "journal_read", description: "Read a journal entry (supports date=latest, section filtering)" },
    { name: "journal_write", description: "Append or replace content in journal" },
    { name: "journal_capture", description: "Lightweight Layer 1 Q&A capture" },
    { name: "journal_list", description: "List recent journal entries" },
    { name: "journal_projects", description: "List all tracked projects" },
    { name: "journal_search", description: "Full-text search across journals" },
    { name: "alignment_check", description: "Record confidence + understanding + human corrections" },
    { name: "nudge", description: "Surface contradiction between current and past input" },
    { name: "context_synthesize", description: "L3 synthesis: patterns, contradictions, goal evolution" },
  ];
  process.stdout.write(JSON.stringify(tools, null, 2) + "\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Auto-detect project slug from environment, git, or cwd.
 * Async to avoid blocking the event loop.
 */
let _cachedProject: string | null = null;

async function detectProject(): Promise<string> {
  if (_cachedProject) return _cachedProject;

  // 1. Env var
  if (process.env.AGENT_RECALL_PROJECT) {
    _cachedProject = process.env.AGENT_RECALL_PROJECT;
    return _cachedProject;
  }

  // 2. Git repo name (async)
  try {
    const { stdout } = await execFileAsync("git", ["config", "--get", "remote.origin.url"], { timeout: 3000 });
    const remote = stdout.trim();
    if (remote) {
      const name = path.basename(remote, ".git");
      if (name) { _cachedProject = name; return name; }
    }
  } catch {
    try {
      const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { timeout: 3000 });
      const root = stdout.trim();
      if (root) { _cachedProject = path.basename(root); return _cachedProject; }
    } catch {
      // fall through
    }
  }

  // 3. package.json name
  const cwd = process.cwd();
  const pkgPath = path.join(cwd, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.name) { _cachedProject = pkg.name.replace(/^@[^/]+\//, "") as string; return _cachedProject!; }
    } catch {
      // fall through
    }
  }

  // 4. Basename of cwd
  _cachedProject = path.basename(cwd);
  return _cachedProject;
}

/**
 * Resolve the journal directory for a project, checking both new and legacy locations.
 * For writes, always use the new location.
 */
function journalDir(project: string): string {
  // Sanitize: prevent path traversal (e.g. "../../etc")
  const safe = project.replace(/[^a-zA-Z0-9_\-\.]/g, "-");
  const resolved = path.join(JOURNAL_ROOT, "projects", safe, "journal");
  if (!resolved.startsWith(JOURNAL_ROOT)) {
    throw new Error(`Invalid project name: ${project}`);
  }
  return resolved;
}

/**
 * Find all journal directories for a project (new + legacy fallback).
 */
function journalDirs(project: string): string[] {
  const dirs: string[] = [];
  const primary = journalDir(project);
  if (fs.existsSync(primary)) dirs.push(primary);

  // Legacy: ~/.claude/projects/*/memory/journal/
  // We try to match project slug in the directory name
  if (fs.existsSync(LEGACY_ROOT)) {
    try {
      const entries = fs.readdirSync(LEGACY_ROOT);
      for (const entry of entries) {
        if (entry.includes(project)) {
          const legacyJournal = path.join(
            LEGACY_ROOT,
            entry,
            "memory",
            "journal"
          );
          if (fs.existsSync(legacyJournal)) {
            dirs.push(legacyJournal);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return dirs;
}

/**
 * List all .md journal files across all directories for a project.
 * Returns sorted array of { date, file, dir } with most recent first.
 */
function listJournalFiles(
  project: string
): Array<{ date: string; file: string; dir: string }> {
  const dirs = journalDirs(project);
  const entries: Array<{ date: string; file: string; dir: string }> = [];
  const seen = new Set<string>();

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      // Match YYYY-MM-DD.md (not log files)
      const match = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        entries.push({ date: match[1], file, dir });
      }
    }
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}

/**
 * Read a journal file. Checks primary dir first, then legacy.
 */
function readJournalFile(project: string, date: string): string | null {
  const filename = `${date}.md`;
  const dirs = journalDirs(project);

  // Also check primary dir even if it wasn't in journalDirs (might not exist yet)
  const primaryDir = journalDir(project);
  const allDirs = [primaryDir, ...dirs.filter((d) => d !== primaryDir)];

  for (const dir of allDirs) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  }
  return null;
}

/**
 * Extract a section from a markdown journal entry.
 */
function extractSection(content: string, section: string): string | null {
  if (section === "all") return content;

  if (section === "brief") {
    // Brief = first 3 non-empty lines after the title + momentum line if present
    const lines = content.split("\n");
    const nonEmpty: string[] = [];
    let pastTitle = false;
    for (const line of lines) {
      if (line.startsWith("# ")) {
        pastTitle = true;
        continue;
      }
      if (!pastTitle) continue;
      const trimmed = line.trim();
      if (trimmed === "") continue;
      nonEmpty.push(trimmed);
      if (nonEmpty.length >= 4) break; // 3 sentences + momentum
    }
    return nonEmpty.join("\n") || null;
  }

  const header = SECTION_HEADERS[section];
  if (!header) return null;

  const idx = content.indexOf(header);
  if (idx === -1) return null;

  // Find the next ## header (respecting code fences)
  const afterHeader = content.slice(idx);
  const lines = afterHeader.split("\n");
  const result: string[] = [lines[0]];
  let inCodeFence = false;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith("```")) inCodeFence = !inCodeFence;
    if (!inCodeFence && lines[i].startsWith("## ")) break;
    result.push(lines[i]);
  }

  return result.join("\n").trimEnd();
}

/**
 * Extract title from journal file content.
 */
function extractTitle(content: string): string {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : "(untitled)";
}

/**
 * Extract momentum indicator from journal content.
 */
function extractMomentum(content: string): string {
  // Look for momentum patterns like 🟢 加速, 🟡 稳定, 🔴 减速
  const patterns = [/[🟢🟡🔴⚪]\s*\S+/];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[0];
  }
  return "";
}

/**
 * Append content to a specific section in a journal file, or to end of file.
 */
function appendToSection(
  existingContent: string,
  newContent: string,
  section: string | null
): string {
  if (section === "replace_all") {
    return newContent;
  }

  if (!section) {
    // Append to end
    return existingContent.trimEnd() + "\n\n" + newContent + "\n";
  }

  const header = SECTION_HEADERS[section];
  if (!header) {
    // Unknown section — append to end
    return existingContent.trimEnd() + "\n\n" + newContent + "\n";
  }

  const idx = existingContent.indexOf(header);
  if (idx === -1) {
    // Section doesn't exist — append it
    return (
      existingContent.trimEnd() + "\n\n" + header + "\n\n" + newContent + "\n"
    );
  }

  // Find the end of this section (next ## header or EOF, respecting code fences)
  const afterHeader = existingContent.slice(idx);
  const lines = afterHeader.split("\n");
  let insertAt = lines.length;
  let inCodeFence = false;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith("```")) inCodeFence = !inCodeFence;
    if (!inCodeFence && lines[i].startsWith("## ")) {
      insertAt = i;
      break;
    }
  }

  // Insert before the next section
  const before = existingContent.slice(
    0,
    idx + lines.slice(0, insertAt).join("\n").length
  );
  const after = existingContent.slice(
    idx + lines.slice(0, insertAt).join("\n").length
  );

  return before.trimEnd() + "\n\n" + newContent + "\n" + after;
}

/**
 * Update the index.md for a project.
 */
function updateIndex(project: string): void {
  const dir = journalDir(project);
  ensureDir(dir);
  const indexPath = path.join(dir, "index.md");

  const entries = listJournalFiles(project);

  let index = `# ${project} — Journal Index\n\n`;
  index += `> Auto-generated. ${entries.length} entries.\n\n`;
  index += `| Date | Title | Momentum |\n`;
  index += `|------|-------|----------|\n`;

  for (const entry of entries) {
    const content = fs.readFileSync(
      path.join(entry.dir, entry.file),
      "utf-8"
    );
    const title = extractTitle(content);
    const momentum = extractMomentum(content);
    index += `| ${entry.date} | ${title} | ${momentum} |\n`;
  }

  fs.writeFileSync(indexPath, index, "utf-8");
}

/**
 * Count entries in a log file (for journal_capture entry numbering).
 */
function countLogEntries(logPath: string): number {
  if (!fs.existsSync(logPath)) return 0;
  const content = fs.readFileSync(logPath, "utf-8");
  const matches = content.match(/^### Q\d+/gm);
  return matches ? matches.length : 0;
}

/**
 * List all projects (from both new and legacy locations).
 */
function listAllProjects(): Array<{
  slug: string;
  lastEntry: string;
  entryCount: number;
}> {
  const projects = new Map<
    string,
    { slug: string; lastEntry: string; entryCount: number }
  >();

  // New location
  const projectsDir = path.join(JOURNAL_ROOT, "projects");
  if (fs.existsSync(projectsDir)) {
    const dirs = fs.readdirSync(projectsDir);
    for (const slug of dirs) {
      const jDir = path.join(projectsDir, slug, "journal");
      if (fs.existsSync(jDir)) {
        const files = fs.readdirSync(jDir).filter((f) =>
          /^\d{4}-\d{2}-\d{2}\.md$/.test(f)
        );
        if (files.length > 0) {
          files.sort().reverse();
          projects.set(slug, {
            slug,
            lastEntry: files[0].replace(".md", ""),
            entryCount: files.length,
          });
        }
      }
    }
  }

  // Legacy location
  if (fs.existsSync(LEGACY_ROOT)) {
    try {
      const entries = fs.readdirSync(LEGACY_ROOT);
      for (const entry of entries) {
        const journalPath = path.join(
          LEGACY_ROOT,
          entry,
          "memory",
          "journal"
        );
        if (fs.existsSync(journalPath)) {
          // Derive slug from directory name (e.g., "-Users-tongwu-some-project" -> "some-project")
          const parts = entry.split("-").filter(Boolean);
          const slug = parts[parts.length - 1] || entry;

          if (!projects.has(slug)) {
            const files = fs.readdirSync(journalPath).filter((f) =>
              /^\d{4}-\d{2}-\d{2}\.md$/.test(f)
            );
            if (files.length > 0) {
              files.sort().reverse();
              projects.set(slug, {
                slug,
                lastEntry: files[0].replace(".md", ""),
                entryCount: files.length,
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const result = Array.from(projects.values());
  result.sort((a, b) => b.lastEntry.localeCompare(a.lastEntry));
  return result;
}

/**
 * Resolve "auto" project to actual slug.
 */
async function resolveProject(project: string | undefined): Promise<string> {
  if (!project || project === "auto") {
    return await detectProject();
  }
  return project;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "agent-recall",
  version: VERSION,
});

// ---------------------------------------------------------------------------
// Tool: journal_read
// ---------------------------------------------------------------------------

server.registerTool("journal_read", {
  title: "Read Journal Entry",
  description:
    "Read a journal entry. Returns the full file content for agent cold-start. Use date='latest' for the most recent entry.",
  inputSchema: {
    date: z
      .string()
      .default("latest")
      .describe(
        "ISO date string YYYY-MM-DD. Defaults to 'latest'. Use 'latest' for most recent entry."
      ),
    project: z
      .string()
      .default("auto")
      .describe(
        "Project slug (directory name under ~/.agent-recall/projects/). Defaults to current git repo name."
      ),
    section: z
      .enum([
        "all",
        "brief",
        "qa",
        "completed",
        "status",
        "blockers",
        "next",
        "decisions",
        "reflection",
        "files",
        "observations",
      ])
      .default("all")
      .describe(
        "Which section to return. 'brief' returns only the cold-start summary. 'all' returns full file."
      ),
  },
}, async ({ date, project, section }) => {
  const slug = await resolveProject(project);
  let targetDate = date;

  if (targetDate === "latest") {
    const entries = listJournalFiles(slug);
    if (entries.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `No journal entries found for project '${slug}'`,
              project: slug,
            }),
          },
        ],
        isError: true,
      };
    }
    targetDate = entries[0].date;
  }

  const fileContent = readJournalFile(slug, targetDate);
  if (!fileContent) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: `No journal entry found for ${targetDate} in project '${slug}'`,
            project: slug,
            date: targetDate,
          }),
        },
      ],
      isError: true,
    };
  }

  const extracted = extractSection(fileContent, section);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          content: extracted || "",
          date: targetDate,
          project: slug,
        }),
      },
    ],
  };
});

// ---------------------------------------------------------------------------
// Tool: journal_write
// ---------------------------------------------------------------------------

server.registerTool("journal_write", {
  title: "Write Journal Entry",
  description:
    "Append content to the current journal entry (creates today's file if absent). Use section='replace_all' to overwrite entire file.",
  inputSchema: {
    content: z.string().describe("Markdown content to append or write."),
    section: z
      .enum([
        "qa",
        "completed",
        "blockers",
        "next",
        "decisions",
        "observations",
        "replace_all",
      ])
      .optional()
      .describe(
        "Target section. If omitted, appends to end of file. 'replace_all' overwrites entire file."
      ),
    project: z
      .string()
      .default("auto")
      .describe("Project slug. Defaults to auto-detect."),
  },
}, async ({ content, section, project }) => {
  const slug = await resolveProject(project);
  const date = todayISO();
  const dir = journalDir(slug);
  ensureDir(dir);

  const filePath = path.join(dir, `${date}.md`);

  let existing = "";
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, "utf-8");
  } else if (!section || section !== "replace_all") {
    // Create a new file with a title
    existing = `# ${date} — ${slug}\n`;
  }

  const sectionArg = section ?? null;
  const updated = appendToSection(existing, content, sectionArg);
  fs.writeFileSync(filePath, updated, "utf-8");

  // Update index
  updateIndex(slug);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          date,
          file: filePath,
        }),
      },
    ],
  };
});

// ---------------------------------------------------------------------------
// Tool: journal_capture
// ---------------------------------------------------------------------------

server.registerTool("journal_capture", {
  title: "Capture Q&A",
  description:
    "Layer 1: lightweight Q&A capture. Appends to today's log file without loading the full journal.",
  inputSchema: {
    question: z
      .string()
      .describe("The human's question or request (summarized, 1 sentence)"),
    answer: z
      .string()
      .describe(
        "The agent's key answer or decision (summarized, 1-2 sentences)"
      ),
    tags: z
      .array(z.string())
      .optional()
      .describe(
        "Optional tags for this entry (e.g. ['decision', 'bug-fix', 'architecture'])"
      ),
    project: z
      .string()
      .default("auto")
      .describe("Project slug. Defaults to auto-detect."),
  },
}, async ({ question, answer, tags, project }) => {
  const slug = await resolveProject(project);
  const date = todayISO();
  const dir = journalDir(slug);
  ensureDir(dir);

  const logPath = path.join(dir, `${date}-log.md`);

  const entryNum = countLogEntries(logPath) + 1;
  const tagStr = tags && tags.length > 0 ? ` [${tags.join(", ")}]` : "";
  const timestamp = new Date().toISOString().slice(11, 19);

  let entry = `### Q${entryNum} (${timestamp})${tagStr}\n\n`;
  entry += `**Q:** ${question}\n\n`;
  entry += `**A:** ${answer}\n\n`;

  if (!fs.existsSync(logPath)) {
    const header = `# ${date} — ${slug} — Session Log\n\n`;
    fs.writeFileSync(logPath, header + entry, "utf-8");
  } else {
    fs.appendFileSync(logPath, entry, "utf-8");
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          entry_number: entryNum,
        }),
      },
    ],
  };
});

// ---------------------------------------------------------------------------
// Tool: journal_list
// ---------------------------------------------------------------------------

server.registerTool("journal_list", {
  title: "List Journal Entries",
  description: "List available journal entries for a project.",
  inputSchema: {
    project: z
      .string()
      .default("auto")
      .describe("Project slug. Defaults to auto-detect."),
    limit: z
      .number()
      .int()
      .default(10)
      .describe("Return the N most recent entries. 0 = all."),
  },
}, async ({ project, limit }) => {
  const slug = await resolveProject(project);
  let entries = listJournalFiles(slug);

  if (limit > 0) {
    entries = entries.slice(0, limit);
  }

  const result = entries.map((e) => {
    const content = fs.readFileSync(path.join(e.dir, e.file), "utf-8");
    return {
      date: e.date,
      title: extractTitle(content),
      momentum: extractMomentum(content),
    };
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          project: slug,
          entries: result,
        }),
      },
    ],
  };
});

// ---------------------------------------------------------------------------
// Tool: journal_projects
// ---------------------------------------------------------------------------

server.registerTool("journal_projects", {
  title: "List Projects",
  description: "List all projects tracked by agent-recall on this machine.",
  inputSchema: {},
}, async () => {
  const projects = listAllProjects();

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          projects: projects.map((p) => ({
            slug: p.slug,
            last_entry: p.lastEntry,
            entry_count: p.entryCount,
          })),
          journal_root: JOURNAL_ROOT,
        }),
      },
    ],
  };
});

// ---------------------------------------------------------------------------
// Tool: journal_search
// ---------------------------------------------------------------------------

server.registerTool("journal_search", {
  title: "Search Journals",
  description: "Full-text search across all journal entries for a project.",
  inputSchema: {
    query: z.string().describe("Search term (plain text, case-insensitive)"),
    project: z
      .string()
      .default("auto")
      .describe("Project slug. Defaults to auto-detect."),
    section: z
      .string()
      .optional()
      .describe("Limit search to a specific section type."),
  },
}, async ({ query, project, section }) => {
  const slug = await resolveProject(project);
  const dirs = journalDirs(slug);
  const queryLower = query.toLowerCase();

  const results: Array<{
    date: string;
    section: string;
    excerpt: string;
    line: number;
  }> = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      let currentSection = "top";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track current section
        if (line.startsWith("## ")) {
          currentSection = line
            .slice(3)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");
        }

        // Filter by section if specified
        if (section && currentSection !== section.toLowerCase()) {
          continue;
        }

        if (line.toLowerCase().includes(queryLower)) {
          const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
          const date = dateMatch ? dateMatch[1] : file;

          // Build excerpt: line with surrounding context
          const start = Math.max(0, line.toLowerCase().indexOf(queryLower) - 40);
          const end = Math.min(
            line.length,
            line.toLowerCase().indexOf(queryLower) + query.length + 40
          );
          let excerpt = line.slice(start, end).trim();
          if (start > 0) excerpt = "..." + excerpt;
          if (end < line.length) excerpt = excerpt + "...";

          results.push({
            date,
            section: currentSection,
            excerpt,
            line: i + 1,
          });
        }
      }
    }
  }

  // Sort by date descending
  results.sort((a, b) => b.date.localeCompare(a.date));

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ results }),
      },
    ],
  };
});

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

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
      contents: [
        {
          uri: uri.href,
          text: content,
          mimeType: "text/markdown",
        },
      ],
    };
  }
);

// Resource: specific date entry
server.registerResource(
  "Journal Entry",
  new ResourceTemplate("agent-recall://{project}/{date}", {
    list: async () => {
      const projects = listAllProjects();
      const resources: Array<{
        uri: string;
        name: string;
        mimeType: string;
      }> = [];
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
      contents: [
        {
          uri: uri.href,
          text: content || `# No entry for ${entryDate}\n`,
          mimeType: "text/markdown",
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: alignment_check (Intelligent Distance measurement)
// ---------------------------------------------------------------------------

server.registerTool("alignment_check", {
  title: "Alignment Check",
  description:
    "Record what the agent understood, its confidence, and any human correction. Measures the Intelligent Distance gap.",
  inputSchema: {
    goal: z.string().describe("Agent's understanding of the goal"),
    confidence: z.enum(["high", "medium", "low"]).describe("Agent's confidence"),
    assumptions: z.array(z.string()).optional().describe("What agent assumed"),
    unclear: z.string().optional().describe("What agent is unsure about"),
    human_correction: z.string().optional().describe("Human's correction or 'confirmed'"),
    delta: z.string().optional().describe("The gap, or 'none'"),
    category: z.enum(["goal", "scope", "priority", "technical", "aesthetic"]).default("goal"),
    project: z.string().default("auto"),
  },
}, async ({ goal, confidence, assumptions, unclear, human_correction, delta, category, project }) => {
  const slug = await resolveProject(project);
  const date = todayISO();
  const dir = journalDir(slug);
  ensureDir(dir);

  const time = new Date().toISOString().slice(11, 19);
  const assumeStr = assumptions?.length ? assumptions.map(a => `  - ${a}`).join("\n") : "  (none)";

  let entry = `### 🎯 Alignment (${time})\n`;
  entry += `**Goal**: ${goal}\n**Confidence**: ${confidence}\n**Category**: ${category}\n`;
  entry += `**Assumptions**:\n${assumeStr}\n`;
  if (unclear) entry += `**Unclear**: ${unclear}\n`;
  if (human_correction) entry += `**Human**: ${human_correction}\n**Delta**: ${delta || "not specified"}\n`;
  entry += "\n";

  const logPath = path.join(dir, `${date}-alignment.md`);
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, `# ${date} — Alignment Records\n\n---\n\n${entry}`, "utf-8");
  } else {
    fs.appendFileSync(logPath, entry, "utf-8");
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ success: true, date, confidence, delta: delta || "pending", file: logPath }) }],
  };
});

// ---------------------------------------------------------------------------
// Tool: nudge (surface human inconsistency)
// ---------------------------------------------------------------------------

server.registerTool("nudge", {
  title: "Nudge",
  description:
    "Surface a contradiction between the human's current input and a prior statement/decision. Helps the human clarify their own thinking.",
  inputSchema: {
    past_statement: z.string().describe("What the human said/decided before (with date if known)"),
    current_statement: z.string().describe("What the human is saying now"),
    question: z.string().describe("The clarifying question to ask"),
    category: z.enum(["goal", "scope", "priority", "technical", "aesthetic"]).default("goal"),
    project: z.string().default("auto"),
  },
}, async ({ past_statement, current_statement, question, category, project }) => {
  const slug = await resolveProject(project);
  const date = todayISO();
  const dir = journalDir(slug);
  ensureDir(dir);

  const time = new Date().toISOString().slice(11, 19);
  let entry = `### 🔔 Nudge (${time})\n`;
  entry += `**Past**: ${past_statement}\n`;
  entry += `**Now**: ${current_statement}\n`;
  entry += `**Question**: ${question}\n`;
  entry += `**Category**: ${category}\n\n`;

  // Append to alignment log (nudges and alignment checks live together)
  const logPath = path.join(dir, `${date}-alignment.md`);
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, `# ${date} — Alignment Records\n\n---\n\n${entry}`, "utf-8");
  } else {
    fs.appendFileSync(logPath, entry, "utf-8");
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ success: true, date, category, file: logPath }) }],
  };
});

// ---------------------------------------------------------------------------
// Tool: context_synthesize (L3 semantic memory)
// ---------------------------------------------------------------------------

server.registerTool("context_synthesize", {
  title: "Synthesize Context",
  description:
    "Generate L3 semantic synthesis from recent journals. Extracts decisions, blockers, goal evolution, and detects contradictions across sessions.",
  inputSchema: {
    entries: z.number().int().default(5).describe("Number of recent entries to analyze"),
    focus: z.enum(["full", "decisions", "blockers", "goals"]).default("full"),
    project: z.string().default("auto"),
  },
}, async ({ entries: count, focus, project }) => {
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

  // Decisions with contradiction detection
  if (focus === "full" || focus === "decisions") {
    syn += `## Decisions\n\n`;
    const allDecisions: string[] = [];
    for (const e of data) {
      if (e.decisions) allDecisions.push(`**${e.date}**:\n${e.decisions}\n`);
    }
    syn += allDecisions.length > 0 ? allDecisions.join("\n") : "(none recorded)\n";

    // Simple contradiction check: find topics mentioned in multiple entries with different content
    if (allDecisions.length >= 2) {
      syn += "\n### Potential Contradictions\n\n";
      syn += "Review the decisions above. Flag if:\n";
      syn += "- A decision from an earlier date was reversed without explanation\n";
      syn += "- The same topic has conflicting approaches across dates\n";
      syn += "- A goal stated in one entry differs from another\n\n";
    }
  }

  // Current blockers
  if (focus === "full" || focus === "blockers") {
    syn += `## Active Blockers\n\n`;
    const latest = data.find(e => e.blockers);
    syn += latest ? `**${latest.date}**:\n${latest.blockers}\n\n` : "(none)\n\n";

    // Check if old blockers are still present
    const oldBlockers = data.filter(e => e.blockers && e !== latest);
    if (oldBlockers.length > 0) {
      syn += "### Recurring Blockers (appeared in older entries too)\n\n";
      for (const ob of oldBlockers.slice(0, 2)) {
        syn += `**${ob.date}**: ${ob.blockers?.split("\n")[0] || ""}\n`;
      }
      syn += "\n";
    }
  }

  // Cross-session observations
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

  // Alignment patterns (if alignment log exists for today)
  const alignPath = path.join(journalDir(slug), `${todayISO()}-alignment.md`);
  if (fs.existsSync(alignPath)) {
    const alignContent = fs.readFileSync(alignPath, "utf-8");
    const checks = (alignContent.match(/### 🎯/g) || []).length;
    const nudges = (alignContent.match(/### 🔔/g) || []).length;
    const low = (alignContent.match(/Confidence: low/g) || []).length;
    if (checks > 0 || nudges > 0) {
      syn += `## Today's Alignment\n\n`;
      syn += `- Alignment checks: ${checks}\n- Nudges: ${nudges}\n- Low confidence: ${low}\n\n`;
    }
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ project: slug, entries_analyzed: toRead.length, synthesis: syn }) }],
  };
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
