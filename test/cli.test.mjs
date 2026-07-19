import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { main } from "../src/cli.mjs";

function capture(stdinText) {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: { write: (value) => { stdout += value; } },
      stderr: { write: (value) => { stderr += value; } },
      stdinText,
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

test("init creates an isolated project instance", async () => {
  const project = mkdtempSync(join(tmpdir(), "ms-project-"));
  spawnSync("git", ["init", "-q"], { cwd: project });
  const captured = capture();

  assert.equal(await main(["init", project], captured.io), 0);
  assert.match(readFileSync(join(project, ".multi-silicon", "config.yaml"), "utf8"), /schemaVersion: 1/);
  assert.match(readFileSync(join(project, ".git", "info", "exclude"), "utf8"), /\.multi-silicon/);
  assert.equal(
    readFileSync(join(project, ".agents", "skills", "multi-silicon-memory", "SKILL.md"), "utf8"),
    readFileSync(join(project, ".multi-silicon", "integrations", "skills", "multi-silicon-memory", "SKILL.md"), "utf8"),
  );
  assert.match(readFileSync(join(project, ".codex", "config.toml"), "utf8"), /mcp_servers\.multi_silicon_memex/);
  assert.match(readFileSync(join(project, ".claude", "settings.local.json"), "utf8"), /SessionStart/);
  assert.equal(spawnSync("git", ["status", "--porcelain"], { cwd: project, encoding: "utf8" }).stdout, "");
});

test("init is idempotent and status discovers the instance", async () => {
  const project = mkdtempSync(join(tmpdir(), "ms-project-"));
  assert.equal(await main(["init", project], capture().io), 0);
  assert.equal(await main(["init", project], capture().io), 0);

  const captured = capture();
  assert.equal(await main(["status", join(project, ".multi-silicon", "memory")], captured.io), 0);
  assert.match(captured.stdout(), /Instance:/);
});

test("init refreshes a formatter-rewritten Codex lifecycle bridge", async () => {
  const project = mkdtempSync(join(tmpdir(), "ms-project-"));
  assert.equal(await main(["init", project], capture().io), 0);
  const bridge = join(project, ".codex", "config.toml");
  writeFileSync(bridge, `
[mcp_servers.memex]
command = "ms"
args = ["memory", "--project", '${project.replaceAll("\\", "\\\\")}', "mcp"]

[[hooks.SessionStart.hooks]]
command = "ms lifecycle hook session-start --agent codex"
[[hooks.UserPromptSubmit.hooks]]
command = "ms lifecycle hook user-prompt --agent codex"
[[hooks.Stop.hooks]]
command = "ms lifecycle hook stop --agent codex"
`, "utf8");

  assert.equal(await main(["init", project], capture().io), 0);
  assert.equal(
    readFileSync(bridge, "utf8"),
    readFileSync(join(project, ".multi-silicon", "integrations", "codex", "config.toml"), "utf8"),
  );
  assert.doesNotMatch(readFileSync(bridge, "utf8"), /mcp_servers\.memex\]/);
});

test("init excludes an instance nested below the Git root", async () => {
  const repository = mkdtempSync(join(tmpdir(), "ms-repository-"));
  const project = join(repository, "packages", "application");
  mkdirSync(project, { recursive: true });
  spawnSync("git", ["init", "-q"], { cwd: repository });

  assert.equal(await main(["init", project], capture().io), 0);
  assert.match(
    readFileSync(join(repository, ".git", "info", "exclude"), "utf8"),
    /\/packages\/application\/\.multi-silicon\//,
  );
});

test("recall and retro are not presented as native Memex commands", async () => {
  const captured = capture();
  assert.equal(await main(["memory", "recall"], captured.io), 1);
  assert.match(captured.stderr(), /Agent lifecycle operation/);
});

test("doctor accepts an explicit Memex provider", async () => {
  const project = mkdtempSync(join(tmpdir(), "ms-project-"));
  const fakeMemex = join(project, "fake-memex.mjs");
  writeFileSync(fakeMemex, "console.log('9.9.9-test');\n", "utf8");
  assert.equal(await main(["init", project], capture().io), 0);

  const previous = process.env.MS_MEMEX_CLI;
  process.env.MS_MEMEX_CLI = fakeMemex;
  try {
    const captured = capture();
    assert.equal(await main(["doctor", project], captured.io), 0);
    assert.match(captured.stdout(), /9\.9\.9-test \(MS_MEMEX_CLI\)/);
  } finally {
    if (previous === undefined) delete process.env.MS_MEMEX_CLI;
    else process.env.MS_MEMEX_CLI = previous;
  }
});

test("memory commands stay inside the selected project Memory Home", async () => {
  const project = mkdtempSync(join(tmpdir(), "ms-project-"));
  const provider = join(project, "fake-memex.mjs");
  const capturePath = join(project, "provider-capture.json");
  writeFileSync(provider, `
import { writeFileSync } from "node:fs";
if (process.argv.includes("--version")) console.log("9.9.9-test");
else writeFileSync(process.env.MS_PROVIDER_CAPTURE, JSON.stringify({ home: process.env.MEMEX_HOME, args: process.argv.slice(2) }));
`, "utf8");
  assert.equal(await main(["init", project], capture().io), 0);

  const previousCli = process.env.MS_MEMEX_CLI;
  const previousCapture = process.env.MS_PROVIDER_CAPTURE;
  process.env.MS_MEMEX_CLI = provider;
  process.env.MS_PROVIDER_CAPTURE = capturePath;
  try {
    assert.equal(await main(["memory", "--project", project, "doctor"], capture().io), 0);
    const providerCall = JSON.parse(readFileSync(capturePath, "utf8"));
    assert.equal(providerCall.home, join(project, ".multi-silicon", "memory"));
    assert.deepEqual(providerCall.args, ["doctor"]);
  } finally {
    if (previousCli === undefined) delete process.env.MS_MEMEX_CLI;
    else process.env.MS_MEMEX_CLI = previousCli;
    if (previousCapture === undefined) delete process.env.MS_PROVIDER_CAPTURE;
    else process.env.MS_PROVIDER_CAPTURE = previousCapture;
  }
});

test("lifecycle hooks surface Recall and gate a missing Retro once", async () => {
  const project = mkdtempSync(join(tmpdir(), "ms-project-"));
  assert.equal(await main(["init", project], capture().io), 0);
  const sessionId = "test-session";
  const start = capture(JSON.stringify({ session_id: sessionId }));
  assert.equal(await main([
    "lifecycle", "hook", "session-start", "--agent", "codex", "--project", project,
  ], start.io), 0);
  assert.match(start.stdout(), /ms lifecycle recall/);
  assert.match(start.stdout(), /ms lifecycle retro/);

  assert.equal(await main([
    "lifecycle", "recall", "--project", project, "--session", sessionId,
    "--action", "skipped", "--reason", "no relevant history",
  ], capture().io), 0);

  const firstStop = capture(JSON.stringify({ session_id: sessionId }));
  assert.equal(await main([
    "lifecycle", "hook", "stop", "--agent", "codex", "--project", project,
  ], firstStop.io), 0);
  assert.deepEqual(JSON.parse(firstStop.stdout()), {
    decision: "block",
    reason: `Multi-Silicon completion gate: Retro decision is missing for session ${sessionId}. Complete the lifecycle commands shown at SessionStart, then finish the response.`,
  });

  assert.equal(await main([
    "lifecycle", "retro", "--project", project, "--session", sessionId,
    "--action", "skip", "--reason", "no durable insight",
  ], capture().io), 0);
  const finalStop = capture(JSON.stringify({ session_id: sessionId }));
  assert.equal(await main([
    "lifecycle", "hook", "stop", "--agent", "codex", "--project", project,
  ], finalStop.io), 0);
  assert.equal(finalStop.stdout(), "");

  const nextTurn = capture(JSON.stringify({ session_id: sessionId, turn_id: "turn-2" }));
  assert.equal(await main([
    "lifecycle", "hook", "user-prompt", "--agent", "codex", "--project", project,
  ], nextTurn.io), 0);
  const nextStop = capture(JSON.stringify({ session_id: sessionId, turn_id: "turn-2" }));
  assert.equal(await main([
    "lifecycle", "hook", "stop", "--agent", "codex", "--project", project,
  ], nextStop.io), 0);
  assert.deepEqual(JSON.parse(nextStop.stdout()), {
    decision: "block",
    reason: `Multi-Silicon completion gate: Recall decision and Retro decision is missing for session ${sessionId}. Complete the lifecycle commands shown at SessionStart, then finish the response.`,
  });
});

test("Retro create and update require a declared read-back verification", async () => {
  const project = mkdtempSync(join(tmpdir(), "ms-project-"));
  assert.equal(await main(["init", project], capture().io), 0);
  const sessionId = "verify-session";
  assert.equal(await main([
    "lifecycle", "hook", "session-start", "--agent", "claude", "--project", project,
  ], capture(JSON.stringify({ session_id: sessionId })).io), 0);

  const unverified = capture();
  assert.equal(await main([
    "lifecycle", "retro", "--project", project, "--session", sessionId,
    "--action", "create", "--reason", "new durable decision",
  ], unverified.io), 1);
  assert.match(unverified.stderr(), /--verified is required/);
  assert.equal(await main([
    "lifecycle", "retro", "--project", project, "--session", sessionId,
    "--action", "create", "--reason", "new durable decision", "--verified",
  ], capture().io), 0);
});

test("init fails loud instead of overwriting a tracked discovery path", async () => {
  const project = mkdtempSync(join(tmpdir(), "ms-project-"));
  spawnSync("git", ["init", "-q"], { cwd: project });
  writeFileSync(join(project, ".mcp.json"), "{\"projectOwned\":true}\n", "utf8");
  spawnSync("git", ["add", ".mcp.json"], { cwd: project });
  const captured = capture();
  assert.equal(await main(["init", project], captured.io), 1);
  assert.match(captured.stdout(), /tracked path cannot be used/);
  assert.equal(readFileSync(join(project, ".mcp.json"), "utf8"), "{\"projectOwned\":true}\n");
});

test("a tracked Skill parent is preserved while lifecycle Hooks remain available", async () => {
  const project = mkdtempSync(join(tmpdir(), "ms-project-"));
  spawnSync("git", ["init", "-q"], { cwd: project });
  mkdirSync(join(project, ".claude"), { recursive: true });
  writeFileSync(join(project, ".claude", "skills"), "project-owned-placeholder\n", "utf8");
  spawnSync("git", ["add", ".claude/skills"], { cwd: project });
  const captured = capture();
  assert.equal(await main(["init", project], captured.io), 0);
  assert.match(captured.stdout(), /parent path is not a directory.*lifecycle Hook remains active/);
  assert.equal(readFileSync(join(project, ".claude", "skills"), "utf8"), "project-owned-placeholder\n");
  assert.match(readFileSync(join(project, ".claude", "settings.local.json"), "utf8"), /SessionStart/);
});
