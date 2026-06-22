import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(__dirname, "..", "dist", "index.js");

describe("project_board text render path (MCP smoke)", () => {
  it("project_board with format='text' returns text containing the board separator bar character", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: [ENTRY, "--full"],
    });

    const client = new Client(
      { name: "board-text-smoke-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);

    let result;
    try {
      result = await client.callTool({ name: "project_board", arguments: { format: "text" } });
    } finally {
      await client.close();
    }

    assert.ok(result, "project_board returned no result");
    assert.ok(Array.isArray(result.content), "result.content is not an array");
    assert.ok(result.content.length > 0, "result.content is empty");

    const text = result.content[0].text;
    assert.ok(typeof text === "string", "result.content[0].text is not a string");
    assert.ok(
      text.includes("─"),
      `project_board text render missing separator bar character '─'\n  Got: ${text.slice(0, 200)}`
    );
  });
});
