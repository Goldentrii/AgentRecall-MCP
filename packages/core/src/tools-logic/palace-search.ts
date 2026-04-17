import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProject } from "../storage/project.js";
import { palaceDir } from "../storage/paths.js";
import { ensurePalaceInitialized, listRooms, recordAccess } from "../palace/rooms.js";

export interface PalaceSearchInput {
  query: string;
  room?: string;
  project?: string;
}

export interface PalaceSearchResult {
  project: string;
  query: string;
  results: Array<{
    room: string;
    file: string;
    salience: number;
    excerpt: string;
    line: number;
    /** Keyword overlap ratio [0,1]. Added in v3.3.14 — used by smart-recall for RRF internal scoring. */
    keyword_score: number;
  }>;
  total_matches: number;
}

/**
 * Parse YAML frontmatter tags from markdown content.
 * Looks for `tags: [...]` line between `---` markers.
 */
function parseFrontmatterTags(content: string): string[] {
  // Find the YAML block between --- markers
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return [];

  const yamlBlock = match[1];
  const tagsLine = yamlBlock.split("\n").find((l) => l.trim().startsWith("tags:"));
  if (!tagsLine) return [];

  // Parse inline array: tags: ["foo", "bar"] or tags: [foo, bar]
  const arrayMatch = tagsLine.match(/tags:\s*\[([^\]]*)\]/);
  if (!arrayMatch) return [];

  return arrayMatch[1]
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter((t) => t.length > 0);
}

export async function palaceSearch(input: PalaceSearchInput): Promise<PalaceSearchResult> {
  const slug = await resolveProject(input.project);
  ensurePalaceInitialized(slug);

  const rooms = listRooms(slug);
  const pd = palaceDir(slug);
  // v3.3.14: use keyword overlap instead of exact substring match.
  // Old approach: lines[i].toLowerCase().includes(fullQuery) required the entire
  // query to appear as one continuous substring — too strict, missed relevant entries.
  // New approach: count matched keywords, compute overlap ratio for scoring.
  const queryWords = input.query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const results: PalaceSearchResult["results"] = [];

  const targetRooms = input.room ? rooms.filter((r) => r.slug === input.room) : rooms;

  for (const roomMeta of targetRooms) {
    const roomPath = path.join(pd, "rooms", roomMeta.slug);
    if (!fs.existsSync(roomPath)) continue;

    const files = fs.readdirSync(roomPath).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = path.join(roomPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      // Parse YAML frontmatter tags for bonus scoring
      const fileTags = parseFrontmatterTags(content);

      // Check if any query words match file-level tags
      const tagBonus = queryWords.some((w) =>
        fileTags.some((t) => t.toLowerCase().includes(w) || w.includes(t.toLowerCase()))
      ) ? 0.3 : 0;

      for (let i = 0; i < lines.length; i++) {
        const lineLower = lines[i].toLowerCase();
        if (queryWords.length === 0) continue;

        // Count how many query keywords appear in this line
        const matchedWords = queryWords.filter((w) => lineLower.includes(w));
        if (matchedWords.length === 0) continue;

        const rawKeywordScore = matchedWords.length / queryWords.length;
        const keywordScore = Math.min(1.0, rawKeywordScore + tagBonus);

        // Build excerpt anchored on first keyword match
        const firstKw = matchedWords[0];
        const matchIdx = lineLower.indexOf(firstKw);
        const start = Math.max(0, matchIdx - 40);
        const end = Math.min(lines[i].length, matchIdx + firstKw.length + 80);
        let excerpt = lines[i].slice(start, end).trim();
        if (start > 0) excerpt = "..." + excerpt;
        if (end < lines[i].length) excerpt = excerpt + "...";

        results.push({
          room: roomMeta.slug,
          file: file.replace(".md", ""),
          salience: roomMeta.salience,
          excerpt,
          line: i + 1,
          keyword_score: keywordScore,
        });
      }
    }

    if (results.some((r) => r.room === roomMeta.slug)) {
      recordAccess(slug, roomMeta.slug);
    }
  }

  // Sort by keyword_score × salience so most relevant + important rooms surface first
  results.sort((a, b) => (b.keyword_score * b.salience) - (a.keyword_score * a.salience) || a.line - b.line);
  const limited = results.slice(0, 20);

  return { project: slug, query: input.query, results: limited, total_matches: results.length };
}
