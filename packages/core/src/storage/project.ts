/**
 * Project detection and listing.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getRoot, getLegacyRoot } from "../types.js";
import type { ProjectInfo } from "../types.js";

const execFileAsync = promisify(execFile);

let _cachedProject: string | null = null;

/**
 * Auto-detect project slug from environment, git, or cwd.
 */
export async function detectProject(): Promise<string> {
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

  // 4. Basename of cwd — but check if it looks like the home directory username
  const candidate = path.basename(cwd);
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const homeBasename = homeDir ? path.basename(homeDir) : "";

  if (candidate && candidate !== homeBasename) {
    _cachedProject = candidate;
    return _cachedProject;
  }

  // 5. cwd resolved to home dir username — try package.json in parent dirs
  let searchDir = cwd;
  for (let i = 0; i < 3; i++) {
    const pkg = path.join(searchDir, "package.json");
    if (fs.existsSync(pkg)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pkg, "utf-8"));
        if (parsed.name) {
          _cachedProject = (parsed.name as string).replace(/^@[^/]+\//, "");
          return _cachedProject!;
        }
      } catch { /* fall through */ }
    }
    const parent = path.dirname(searchDir);
    if (parent === searchDir) break;
    searchDir = parent;
  }

  // 6. Final fallback: use the directory name even if it matches username
  _cachedProject = candidate || "default";
  return _cachedProject;
}

/**
 * Resolve "auto" project to actual slug.
 */
export async function resolveProject(project: string | undefined): Promise<string> {
  if (!project || project === "auto") {
    return await detectProject();
  }
  return project;
}

/**
 * List all projects (from both new and legacy locations).
 */
export function listAllProjects(): ProjectInfo[] {
  const projects = new Map<string, ProjectInfo>();

  // New location
  const projectsDir = path.join(getRoot(), "projects");
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
  const legacyRoot = getLegacyRoot();
  if (fs.existsSync(legacyRoot)) {
    try {
      const entries = fs.readdirSync(legacyRoot);
      for (const entry of entries) {
        const journalPath = path.join(legacyRoot, entry, "memory", "journal");
        if (fs.existsSync(journalPath)) {
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
