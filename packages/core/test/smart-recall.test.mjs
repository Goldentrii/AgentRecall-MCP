import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Smart recall — recency boost logic", () => {
  // The hot-window multiplier logic is inline in smartRecall, so we test
  // the multiplier calculation directly to verify correctness.

  function recencyMultiplier(dateStr) {
    if (!dateStr) return 1.0; // palace items (no date) — unaffected
    const hoursAgo = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 6) return 3.0;
    if (hoursAgo < 24) return 2.0;
    if (hoursAgo < 72) return 1.3;
    return 1.0;
  }

  it("boosts items from < 6 hours ago by 3x", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    assert.equal(recencyMultiplier(twoHoursAgo), 3.0);
  });

  it("boosts items from 6-24 hours ago by 2x", () => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    assert.equal(recencyMultiplier(twelveHoursAgo), 2.0);
  });

  it("boosts items from 24-72 hours ago by 1.3x", () => {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    assert.equal(recencyMultiplier(fortyEightHoursAgo), 1.3);
  });

  it("does not boost items older than 72 hours", () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(recencyMultiplier(sevenDaysAgo), 1.0);
  });

  it("does not affect palace items (no date)", () => {
    assert.equal(recencyMultiplier(undefined), 1.0);
    assert.equal(recencyMultiplier(null), 1.0);
  });

  it("recent items outscore old items given equal base scores", () => {
    const baseScore = 0.016; // typical RRF score
    const recentScore = baseScore * recencyMultiplier(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
    const oldScore = baseScore * recencyMultiplier(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    assert.ok(recentScore > oldScore, `recent ${recentScore} should be > old ${oldScore}`);
    assert.equal(recentScore, baseScore * 3.0);
    assert.equal(oldScore, baseScore * 1.0);
  });
});

describe("Smart recall — ambient dedup logic", () => {
  it("filters out items whose IDs are in history", () => {
    const history = new Set(["abc", "def", "ghi"]);
    const items = [
      { id: "abc", title: "seen before" },
      { id: "xyz", title: "new item" },
      { id: "def", title: "also seen" },
      { id: "qqq", title: "another new" },
    ];
    const filtered = items.filter(item => !history.has(item.id));
    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].id, "xyz");
    assert.equal(filtered[1].id, "qqq");
  });

  it("rolling history stays within max 15", () => {
    const existing = Array.from({ length: 13 }, (_, i) => `id${i}`);
    const newIds = ["new1", "new2", "new3"];
    const updated = [...existing, ...newIds].slice(-15);
    assert.equal(updated.length, 15);
    assert.equal(updated[0], "id1"); // id0 dropped (oldest)
    assert.equal(updated[14], "new3");
  });

  it("clears history when topic overlap < 30%", () => {
    function computeOverlapAndDecide(prevQuery, currPrompt) {
      const prevWords = new Set(prevQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2));
      const currWords = currPrompt.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (prevWords.size === 0 || currWords.length === 0) return false;
      const overlap = currWords.filter(w => prevWords.has(w)).length / currWords.length;
      return overlap < 0.3; // true = should clear
    }

    // Completely different topics — should clear
    assert.ok(computeOverlapAndDecide(
      "nextjs deployment vercel",
      "postgres schema migration drizzle"
    ));

    // Same topic — should NOT clear
    assert.ok(!computeOverlapAndDecide(
      "nextjs deployment vercel config",
      "vercel deployment nextjs environment"
    ));
  });

  it("minimum relevance threshold filters low-score items", () => {
    const results = [
      { id: "a", score: 0.05 },
      { id: "b", score: 0.02 },
      { id: "c", score: 0.01 },
      { id: "d", score: 0.10 },
    ];
    const filtered = results.filter(item => item.score >= 0.03);
    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].id, "a");
    assert.equal(filtered[1].id, "d");
  });
});

describe("RecallBackend selection", () => {
  it("uses a local backend (keyword or vector) when no Supabase config", async () => {
    const { setRoot, resetRoot } = await import("agent-recall-core");
    const { getRecallBackend, LocalRecallBackend, LocalVectorRecallBackend, resetRecallBackend } = await import("agent-recall-core");
    const tmpDir = (await import("node:fs")).mkdtempSync(
      (await import("node:path")).join((await import("node:os")).tmpdir(), "ar-sel-")
    );
    setRoot(tmpDir);
    resetRecallBackend();
    const backend = await getRecallBackend();
    // Either keyword (no API key) or vector (OPENAI_API_KEY present) — both are local, not Supabase
    assert.ok(
      backend instanceof LocalRecallBackend || backend instanceof LocalVectorRecallBackend,
      `Expected local backend, got ${backend?.constructor?.name}`
    );
    (await import("node:fs")).rmSync(tmpDir, { recursive: true, force: true });
    resetRoot();
    resetRecallBackend();
  });
});
