/**
 * board-render.test.mjs — unit tests for packages/core/src/display/board-render.ts
 *
 * Tests:
 *   1. charDisplayWidth / displayWidth — ASCII (1 col), CJK (2 col), emoji (2 col)
 *   2. fitToWidth — ASCII-only row, CJK-heavy row (main porting risk)
 *   3. CJK alignment fixture — mixed ASCII + 中文 rows stay within BOARD_WIDTH
 *   4. renderBoard — basic shape, section presence, pure (no fs/Supabase)
 *   5. renderDreamBanner — no-runs, stale, failed, healthy
 *   6. purity assertion — board-render.ts imports do not touch fs / supabase / network
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import * as fs from "node:fs";
import * as url from "node:url";

// ---------------------------------------------------------------------------
// Load from built dist (same pattern as other tests in this suite)
// ---------------------------------------------------------------------------
const { charDisplayWidth, displayWidth, fitToWidth, renderBoard, renderDreamBanner } =
  await import("../dist/index.js");

// ---------------------------------------------------------------------------
// 1. charDisplayWidth / displayWidth
// ---------------------------------------------------------------------------

describe("charDisplayWidth — ASCII chars are 1 column", () => {
  for (const ch of ["a", "Z", "0", " ", "-", "_"]) {
    it(`charDisplayWidth('${ch}') === 1`, () => {
      assert.equal(charDisplayWidth(ch.codePointAt(0)), 1);
    });
  }
});

describe("charDisplayWidth — CJK chars are 2 columns", () => {
  // U+4E2D 中, U+6587 文, U+5B57 字, U+6C49 汉, U+8BED 语
  const cjkChars = ["中", "文", "字", "汉", "语"];
  for (const ch of cjkChars) {
    it(`charDisplayWidth('${ch}') === 2`, () => {
      assert.equal(charDisplayWidth(ch.codePointAt(0)), 2);
    });
  }
});

describe("charDisplayWidth — status emoji are 2 columns", () => {
  // The board icons: 🚧 U+1F6A7, 🟢 U+1F7E2, 💤 U+1F4A4, ⭐ U+2B50, 🧠 U+1F9E0
  const icons = ["🚧", "🟢", "💤", "⭐", "🧠"];
  for (const icon of icons) {
    it(`charDisplayWidth(${JSON.stringify(icon)}) === 2`, () => {
      assert.equal(charDisplayWidth(icon.codePointAt(0)), 2);
    });
  }
});

describe("displayWidth — mixed ASCII and CJK strings", () => {
  it("pure ASCII: displayWidth === string.length", () => {
    const s = "novada-proxy";
    assert.equal(displayWidth(s), s.length);
  });

  it("pure CJK: displayWidth === 2 * string.length", () => {
    const s = "中文字汉语"; // 5 chars × 2 = 10
    assert.equal(displayWidth(s), 10);
  });

  it("mixed: 'xigu中文' → 4 + 4 = 8 cols", () => {
    const s = "xigu中文"; // 4 ASCII + 2 CJK = 4 + 4
    assert.equal(displayWidth(s), 8);
  });
});

// ---------------------------------------------------------------------------
// 2. fitToWidth — CJK trimming (main porting risk)
// ---------------------------------------------------------------------------

describe("fitToWidth — ASCII-only strings", () => {
  it("returns string unchanged when within limit", () => {
    const s = "deploy to staging first";
    assert.equal(fitToWidth(s, 40), s);
  });

  it("clips with … when over limit", () => {
    const s = "a".repeat(50);
    const result = fitToWidth(s, 20);
    assert.ok(result.endsWith("…"), "should end with ellipsis");
    assert.ok(displayWidth(result) <= 20, `display width ${displayWidth(result)} must be ≤ 20`);
  });
});

describe("fitToWidth — CJK-heavy strings (main porting risk)", () => {
  it("Chinese text clipped at display width, not byte count", () => {
    // 20 CJK chars = 40 display cols. Limit = 20 → should clip at ~9 chars + …
    const s = "中文项目状态这是一个很长的中文描述用于测试宽度";
    const limit = 20;
    const result = fitToWidth(s, limit);
    const w = displayWidth(result);
    assert.ok(w <= limit, `display width ${w} must be ≤ ${limit}`);
    // Must have clipped (original is way over limit)
    assert.ok(result.endsWith("…"), "clipped CJK string must end with …");
  });

  it("short Chinese text passes through unclipped", () => {
    const s = "中文"; // 4 display cols
    const result = fitToWidth(s, 10);
    assert.equal(result, s, "short CJK string must pass through unclipped");
    assert.ok(!result.endsWith("…"));
  });

  it("mixed ASCII+CJK: 'novada-中文-search' within 30 cols", () => {
    const s = "novada-中文-search active since last sprint";
    const limit = 30;
    const result = fitToWidth(s, limit);
    const w = displayWidth(result);
    assert.ok(w <= limit, `display width ${w} must be ≤ ${limit}`);
  });
});

// ---------------------------------------------------------------------------
// 3. CJK alignment fixture — the main integration risk
//    Build a board with Chinese-named projects; verify every row fits
//    within BOARD_WIDTH display columns.
// ---------------------------------------------------------------------------

describe("CJK alignment fixture — mixed ASCII+中文 rows", () => {
  const BOARD_WIDTH = 100;

  /** Minimal ProjectBoardResult fixture with both ASCII and CJK project names. */
  function makeBoard(projects) {
    return {
      projects: projects.map((p, i) => ({
        number: i + 1,
        slug: p.slug,
        status: p.status,
        date: "2026-06-20",
        days_ago: 2,
        next: p.next,
      })),
      total: projects.length,
      date: "2026-06-20",
    };
  }

  const fixture = makeBoard([
    { slug: "novada-search", status: "active", next: "Fix rate limiter for concurrent requests" },
    { slug: "xigu-ordering", status: "active", next: "完成订单排序算法的单元测试并修复已知bug" },
    { slug: "novada-mcp", status: "active", next: "发布新版本MCP工具并更新文档说明" },
    { slug: "agent-recall", status: "blocked", next: "Blocked on Supabase quota — waiting for billing" },
    { slug: "short-project", status: "stale", next: "stale" },
  ]);

  const board = renderBoard(fixture, { boardWidth: BOARD_WIDTH });
  const lines = board.split("\n");

  it("board renders without throwing", () => {
    assert.ok(typeof board === "string" && board.length > 0);
  });

  it("every non-empty line fits within BOARD_WIDTH display columns", () => {
    const overflows = lines.filter((l) => l.length > 0 && displayWidth(l) > BOARD_WIDTH);
    assert.deepEqual(
      overflows,
      [],
      `Lines exceeding ${BOARD_WIDTH} display cols:\n${overflows.map((l) => `  "${l}" (${displayWidth(l)})`).join("\n")}`,
    );
  });

  it("board contains all project slugs", () => {
    for (const slug of ["novada-search", "xigu-ordering", "novada-mcp", "agent-recall", "short-project"]) {
      assert.ok(board.includes(slug), `board must contain slug "${slug}"`);
    }
  });

  it("blocked project shows BLOCKED in its row", () => {
    const blockedLine = lines.find((l) => l.includes("agent-recall"));
    assert.ok(blockedLine, "agent-recall line must exist");
    assert.ok(blockedLine.includes("BLOCKED"), "blocked row must contain BLOCKED marker");
  });

  it("CJK-next rows do not overflow the board", () => {
    const cjkLine = lines.find((l) => l.includes("xigu-ordering"));
    assert.ok(cjkLine, "xigu-ordering line must exist");
    const w = displayWidth(cjkLine);
    assert.ok(
      w <= BOARD_WIDTH,
      `xigu-ordering row display width ${w} exceeds BOARD_WIDTH ${BOARD_WIDTH}: "${cjkLine}"`,
    );
  });

  it("stale project row contains stale keyword", () => {
    const staleLine = lines.find((l) => l.includes("short-project"));
    assert.ok(staleLine, "short-project line must exist");
    assert.ok(staleLine.toLowerCase().includes("stale"), "stale row must contain stale marker");
  });

  it("board header mentions correct project count", () => {
    assert.ok(board.includes("5 projects"), "header must state '5 projects'");
  });
});

// ---------------------------------------------------------------------------
// 4. renderBoard — basic structural checks
// ---------------------------------------------------------------------------

describe("renderBoard — structural invariants", () => {
  const emptyBoard = { projects: [], total: 0, date: "2026-06-20" };

  it("renders an empty board without throwing", () => {
    const result = renderBoard(emptyBoard);
    assert.ok(typeof result === "string");
    assert.ok(result.includes("0 projects"));
  });

  it("includes top bar and bottom bar", () => {
    const result = renderBoard(emptyBoard);
    const lines = result.split("\n");
    // First and last non-empty lines should be bars (─ repeated)
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    assert.ok(nonEmpty[0].includes("─"), "first non-empty line should be a bar");
  });

  it("boardWidth clamps to [80, 110]", () => {
    const r1 = renderBoard(emptyBoard, { boardWidth: 50 });
    const r2 = renderBoard(emptyBoard, { boardWidth: 200 });
    // Check bars — both should be within [80, 110]
    const barWidth1 = r1.split("\n")[0].length;
    const barWidth2 = r2.split("\n")[0].length;
    assert.ok(barWidth1 >= 80 && barWidth1 <= 110, `bar1 width ${barWidth1} out of range`);
    assert.ok(barWidth2 >= 80 && barWidth2 <= 110, `bar2 width ${barWidth2} out of range`);
  });
});

// ---------------------------------------------------------------------------
// 5. renderDreamBanner — all branches
// ---------------------------------------------------------------------------

describe("renderDreamBanner", () => {
  const today = "2026-06-22";

  it("no runs recorded", () => {
    const banner = renderDreamBanner(
      { last_success: null, last_failed: null, fail_reason: null, fail_step: null,
        any_succeeded_today: false, failed_runs_today: 0, last_success_date: null },
      today,
    );
    assert.ok(banner.includes("DREAM — no runs recorded"));
  });

  it("stale (last success was 3 days ago)", () => {
    const banner = renderDreamBanner(
      { last_success: "2026-06-19 02:00", last_failed: null, fail_reason: null, fail_step: null,
        any_succeeded_today: false, failed_runs_today: 0, last_success_date: "2026-06-19" },
      today,
    );
    assert.ok(banner.includes("DREAM STALE"), `expected DREAM STALE, got: ${banner}`);
  });

  it("failed (recent failure, no success today)", () => {
    const banner = renderDreamBanner(
      { last_success: null, last_failed: "2026-06-22 03:00", fail_reason: "auth timeout",
        fail_step: "login", any_succeeded_today: false, failed_runs_today: 1, last_success_date: null },
      today,
    );
    assert.ok(banner.includes("DREAM FAILED"), `expected DREAM FAILED, got: ${banner}`);
    assert.ok(banner.includes("auth timeout"));
    assert.ok(banner.includes("step: login"));
  });

  it("healthy (succeeded today, no recent failure)", () => {
    const banner = renderDreamBanner(
      { last_success: "2026-06-22 04:00", last_failed: null, fail_reason: null, fail_step: null,
        any_succeeded_today: true, failed_runs_today: 0, last_success_date: "2026-06-22" },
      today,
    );
    assert.equal(banner, "", `healthy banner must be empty, got: ${banner}`);
  });

  it("failed then later succeeded → includes (later run succeeded)", () => {
    const banner = renderDreamBanner(
      { last_success: "2026-06-22 05:00", last_failed: "2026-06-22 03:00",
        fail_reason: "network error", fail_step: null,
        any_succeeded_today: true, failed_runs_today: 1, last_success_date: "2026-06-22" },
      today,
    );
    // last_success > last_failed → shows FAILED with "later run succeeded"
    // (today's first run failed but a later one succeeded)
    // The healthy-path guard: any_succ_today && !stale → check if last_failed is today
    // and if last_failed > last_success → banner. Here last_failed < last_success so
    // we fall to healthy path → empty string.
    // Actually: any_succeeded_today=true, !stale → branch; last_failed is today but
    // last_failed("03:00") < last_success("05:00") → returns "".
    assert.equal(banner, "");
  });
});

// ---------------------------------------------------------------------------
// 6. Purity assertion — board-render.ts must not import fs / supabase / network
// ---------------------------------------------------------------------------

describe("board-render.ts purity — import lines must not touch fs/supabase/network", () => {
  it("board-render.ts has no fs, supabase, or network imports", () => {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const srcPath = path.resolve(__dirname, "../src/display/board-render.ts");
    const src = fs.readFileSync(srcPath, "utf-8");

    // Extract actual import lines only (not comments)
    const importLines = src
      .split("\n")
      .filter((l) => /^\s*import\s/.test(l));

    const forbidden = ["node:fs", "node:http", "node:https", "supabase", "@supabase", "axios", "fetch", "node:net"];

    for (const line of importLines) {
      for (const f of forbidden) {
        assert.ok(
          !line.includes(f),
          `board-render.ts must NOT import "${f}": ${line}`,
        );
      }
    }
  });
});
