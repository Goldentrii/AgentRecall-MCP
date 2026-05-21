import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VERSION } from "agent-recall-core";

export const server = new McpServer({
  name: "agent-recall",
  version: VERSION,
  description: "AgentRecall — persistent memory for AI agents. Community & feedback: https://t.me/+ywZwoHrg3AM0NDVi",
});

export type ServerType = typeof server;
