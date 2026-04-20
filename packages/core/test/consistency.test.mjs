import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");

function readPkgVersion(pkgDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, pkgDir, "package.json"), "utf-8"));
  return { name: pkg.name, version: pkg.version };
}

describe("Codebase consistency — versions must match", () => {
  const core = readPkgVersion("packages/core");
  const mcp = readPkgVersion("packages/mcp-server");
  const cli = readPkgVersion("packages/cli");
  const sdk = readPkgVersion("packages/sdk");

  // types.ts VERSION constant
  const typesContent = fs.readFileSync(path.join(ROOT, "packages/core/src/types.ts"), "utf-8");
  const versionMatch = typesContent.match(/VERSION\s*=\s*"([^"]+)"/);
  const typesVersion = versionMatch ? versionMatch[1] : "NOT_FOUND";

  it("core package.json matches types.ts VERSION constant", () => {
    assert.equal(core.version, typesVersion,
      `package.json says ${core.version} but types.ts says ${typesVersion}`);
  });

  it("mcp-server version matches core version", () => {
    assert.equal(mcp.version, core.version,
      `mcp-server@${mcp.version} !== core@${core.version}`);
  });

  it("cli version matches core version", () => {
    assert.equal(cli.version, core.version,
      `cli@${cli.version} !== core@${core.version}`);
  });

  it("sdk version matches core version", () => {
    assert.equal(sdk.version, core.version,
      `sdk@${sdk.version} !== core@${core.version}`);
  });
});

describe("Codebase consistency — dependency constraints", () => {
  const coreVersion = readPkgVersion("packages/core").version;
  const majorMinor = coreVersion.split(".").slice(0, 2).join(".");

  function getCoreDep(pkgDir) {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, pkgDir, "package.json"), "utf-8"));
    return pkg.dependencies?.["agent-recall-core"] ?? "NONE";
  }

  it("mcp-server depends on a recent core version", () => {
    const dep = getCoreDep("packages/mcp-server");
    assert.ok(dep !== "NONE", "mcp-server should depend on agent-recall-core");
    // Extract minimum version from constraint (e.g., "^3.3.19" → "3.3.19")
    const minVersion = dep.replace(/[\^~>=<]*/g, "");
    const minMinor = parseInt(minVersion.split(".")[2], 10);
    const coreMinor = parseInt(coreVersion.split(".")[2], 10);
    const drift = coreMinor - minMinor;
    assert.ok(drift <= 3, `mcp-server dep ${dep} is ${drift} patches behind core@${coreVersion}`);
  });

  it("cli depends on a recent core version", () => {
    const dep = getCoreDep("packages/cli");
    const minVersion = dep.replace(/[\^~>=<]*/g, "");
    const minMinor = parseInt(minVersion.split(".")[2], 10);
    const coreMinor = parseInt(coreVersion.split(".")[2], 10);
    const drift = coreMinor - minMinor;
    assert.ok(drift <= 3, `cli dep ${dep} is ${drift} patches behind core@${coreVersion}`);
  });

  it("sdk depends on a recent core version", () => {
    const dep = getCoreDep("packages/sdk");
    const minVersion = dep.replace(/[\^~>=<]*/g, "");
    const minMinor = parseInt(minVersion.split(".")[2], 10);
    const coreMinor = parseInt(coreVersion.split(".")[2], 10);
    const drift = coreMinor - minMinor;
    assert.ok(drift <= 3, `sdk dep ${dep} is ${drift} patches behind core@${coreVersion}`);
  });
});
