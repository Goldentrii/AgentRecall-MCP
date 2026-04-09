/**
 * Fan-out write logic.
 * When content is written to a room, this module:
 * 1. Parses [[wikilinks]] from the content
 * 2. Adds back-references in referenced rooms
 * 3. Updates graph.json with new edges
 * 4. Recalculates salience for affected rooms
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { palaceDir } from "../storage/paths.js";
import { extractWikilinks, addBackReference } from "./obsidian.js";
import { addEdge, getConnectionCount } from "./graph.js";
import { getRoomMeta, updateRoomMeta } from "./rooms.js";
import { computeSalience } from "./salience.js";
import type { Importance } from "../types.js";

export interface FanOutResult {
  updatedRooms: string[];
  newEdges: number;
}

export function fanOut(
  project: string,
  sourceRoom: string,
  sourceTopic: string,
  content: string,
  explicitConnections: string[] = [],
  importance: Importance = "medium"
): FanOutResult {
  const pd = palaceDir(project);
  const result: FanOutResult = { updatedRooms: [], newEdges: 0 };

  // Collect all targets: from wikilinks + explicit connections
  const wikiTargets = extractWikilinks(content);
  const allTargets = new Set<string>([...wikiTargets, ...explicitConnections]);

  for (const target of allTargets) {
    // Target could be "roomSlug" or "roomSlug/topic"
    const targetRoom = target.split("/")[0];
    if (targetRoom === sourceRoom) continue; // skip self-references

    // Add back-reference in target room's README.md
    const targetReadme = path.join(pd, "rooms", targetRoom, "README.md");
    if (fs.existsSync(targetReadme)) {
      const readmeContent = fs.readFileSync(targetReadme, "utf-8");
      const updated = addBackReference(readmeContent, sourceRoom, sourceTopic);
      if (updated !== readmeContent) {
        fs.writeFileSync(targetReadme, updated, "utf-8");
        result.updatedRooms.push(targetRoom);
      }
    }

    // Add edge to graph
    addEdge(pd, `${sourceRoom}/${sourceTopic}`, target, "references");
    result.newEdges++;

    // Update target room's connections list
    const targetMeta = getRoomMeta(project, targetRoom);
    if (targetMeta && !targetMeta.connections.includes(sourceRoom)) {
      updateRoomMeta(project, targetRoom, {
        connections: [...targetMeta.connections, sourceRoom],
      });
    }
  }

  // Update source room's connections list
  const sourceMeta = getRoomMeta(project, sourceRoom);
  if (sourceMeta) {
    const newConns = new Set(sourceMeta.connections);
    for (const target of allTargets) {
      const targetRoom = target.split("/")[0];
      if (targetRoom !== sourceRoom) newConns.add(targetRoom);
    }
    updateRoomMeta(project, sourceRoom, {
      connections: Array.from(newConns),
    });
  }

  // Recalculate salience for all affected rooms
  const affectedRooms = new Set([sourceRoom, ...result.updatedRooms]);
  for (const room of affectedRooms) {
    const meta = getRoomMeta(project, room);
    if (!meta) continue;

    const connCount = getConnectionCount(pd, room);
    const newSalience = computeSalience({
      importance,
      lastUpdated: meta.updated,
      accessCount: meta.access_count,
      connectionCount: connCount,
    });

    updateRoomMeta(project, room, { salience: newSalience });
  }

  return result;
}
