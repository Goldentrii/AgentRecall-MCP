  import { journalWrite } from "./journal-write.js";
  import { palaceWrite } from "./palace-write.js";
  import { awarenessUpdate } from "./awareness-update.js";
  import { generateSlug } from "../helpers/auto-name.js";

  export async function getMemoryMap(): Promise<string> {
    return JSON.stringify({
      memory_structure: {
        "/journal": {
          level: "L1/L2",
          description: "Daily logs, ephemeral states, bug tracking steps.",
          usage: "Default fallback for daily tasks."
        },
        "/palace/<room_name>": {
          level: "L3",
          description: "Persistent project knowledge, rules, and architectural decisions.",
          available_rooms: ["architecture", "database", "rules", "blockers"],
          usage: "Replace <room_name> with target. E.g., '/palace/architecture'."
        },
        "/awareness": {
          level: "L4",
          description: "High-level, cross-project insights and critical invariant rules.",
          usage: "Strictly for hard-learned lessons and core invariants."
        }
      }
    }, null, 2);
  }

  export async function executeStoreMemory(targetPath: string, content: string): Promise<any> {
    const path = targetPath.toLowerCase().trim();

    if (path.startsWith('/palace/')) {
      const room = path.replace('/palace/', '') || 'general';
      return await palaceWrite(room, content, { importance: 'medium' });
    }

    if (path === '/awareness') {
      const title = generateSlug(content);
      return await awarenessUpdate({
        insights: [{
          title,
          evidence: content,
          applies_when: ["general"],
          source: "auto-router"
        }]
      });
    }

    return await journalWrite(content);
  }
