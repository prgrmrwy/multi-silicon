import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { main } from "../src/cli.mjs";

function capture() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: { write: (value) => { stdout += value; } },
      stderr: { write: (value) => { stderr += value; } },
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
});

test("init is idempotent and status discovers the instance", async () => {
  const project = mkdtempSync(join(tmpdir(), "ms-project-"));
  assert.equal(await main(["init", project], capture().io), 0);
  assert.equal(await main(["init", project], capture().io), 0);

  const captured = capture();
  assert.equal(await main(["status", join(project, ".multi-silicon", "memory")], captured.io), 0);
  assert.match(captured.stdout(), /Instance:/);
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
