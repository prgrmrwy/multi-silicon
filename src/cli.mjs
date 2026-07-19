import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = join(packageRoot, "templates", "project-instance", ".multi-silicon");
const packagedSkillsRoot = join(packageRoot, "skills");
const frameworkVersion = "0.1.0";
const memexPackagePath = join("@touchskyer", "memex", "dist", "cli.js");

const help = `Multi-Silicon CLI

Usage:
  ms init [path]       Create a local .multi-silicon project instance
  ms status [path]     Show the nearest project instance
  ms doctor [path]     Validate the project instance and dependencies
  ms memory <args...>  Run a native Memex command for this project instance
  ms lifecycle ...     Record Recall/Retro and serve Agent lifecycle hooks
  ms help              Show this help
`;

function output(message, io) {
  io.stdout.write(`${message}\n`);
}

function fail(message, io) {
  io.stderr.write(`Error: ${message}\n`);
  return 1;
}

function replaceTokens(root, tokens) {
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      replaceTokens(path, tokens);
      continue;
    }
    let content = readFileSync(path, "utf8");
    for (const [token, value] of Object.entries(tokens)) {
      content = content.replaceAll(token, value);
    }
    writeFileSync(path, content, "utf8");
  }
}

function copyMissing(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source)) {
    const sourcePath = join(source, entry);
    const destinationPath = join(destination, entry);
    if (statSync(sourcePath).isDirectory()) {
      copyMissing(sourcePath, destinationPath);
      continue;
    }
    if (!existsSync(destinationPath)) {
      writeFileSync(destinationPath, readFileSync(sourcePath));
    }
  }
}

function git(command, cwd) {
  return spawnSync("git", command, { cwd, encoding: "utf8", windowsHide: true });
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
}

function resolveMemexRunner() {
  const roots = new Set();
  if (process.env.MS_MEMEX_CLI) {
    const explicit = resolve(process.env.MS_MEMEX_CLI);
    if (existsSync(explicit)) {
      const version = run(process.execPath, [explicit, "--version"]);
      if (version.status === 0) {
        return {
          command: process.execPath,
          prefixArgs: [explicit],
          version: version.stdout.trim(),
          source: "MS_MEMEX_CLI",
        };
      }
    }
  }

  const direct = run("memex", ["--version"]);
  if (direct.status === 0) {
    return {
      command: "memex",
      prefixArgs: [],
      version: direct.stdout.trim(),
      source: "PATH",
    };
  }

  roots.add(join(dirname(process.execPath), "node_modules"));
  if (process.env.APPDATA) roots.add(join(process.env.APPDATA, "npm", "node_modules"));

  if (process.platform !== "win32") {
    const npmRoot = run("npm", ["root", "--global"]);
    if (npmRoot.status === 0 && npmRoot.stdout.trim()) roots.add(resolve(npmRoot.stdout.trim()));
  }

  for (const root of roots) {
    const cli = join(root, memexPackagePath);
    if (!existsSync(cli)) continue;
    const version = run(process.execPath, [cli, "--version"]);
    if (version.status === 0) {
      return {
        command: process.execPath,
        prefixArgs: [cli],
        version: version.stdout.trim(),
        source: "global Node package",
      };
    }
  }
  return null;
}

function gitContext(projectRoot) {
  const topLevelResult = git(["rev-parse", "--show-toplevel"], projectRoot);
  if (topLevelResult.status !== 0) {
    return null;
  }

  const gitRoot = resolve(topLevelResult.stdout.trim());
  const excludeResult = git(["rev-parse", "--git-path", "info/exclude"], projectRoot);
  if (excludeResult.status !== 0) {
    return null;
  }
  return { gitRoot, excludePath: resolve(projectRoot, excludeResult.stdout.trim()) };
}

function localPattern(gitRoot, path, directory = false) {
  const itemRelative = relative(gitRoot, path).replaceAll("\\", "/");
  return `/${itemRelative}${directory ? "/" : ""}`.replace("//", "/");
}

function addLocalGitExcludes(projectRoot, entries) {
  const context = gitContext(projectRoot);
  if (!context) return { changed: false, reason: "not-a-git-repository", patterns: [] };

  const patterns = entries.map(({ path, directory }) => localPattern(context.gitRoot, path, directory));
  const current = existsSync(context.excludePath) ? readFileSync(context.excludePath, "utf8") : "";
  const lines = current.split(/\r?\n/).map((line) => line.trim());
  const missing = patterns.filter((pattern) => !lines.includes(pattern));
  if (missing.length === 0) return { changed: false, reason: "already-excluded", patterns };

  mkdirSync(dirname(context.excludePath), { recursive: true });
  const prefix = current.length === 0 || current.endsWith("\n") ? "" : "\n";
  appendFileSync(
    context.excludePath,
    `${prefix}# Multi-Silicon local project instance and discovery bridges\n${missing.join("\n")}\n`,
    "utf8",
  );
  return { changed: true, patterns };
}

function isTracked(projectRoot, path) {
  const context = gitContext(projectRoot);
  if (!context) return false;
  const pathRelative = relative(context.gitRoot, path).replaceAll("\\", "/");
  return git(["ls-files", "--error-unmatch", "--", pathRelative], context.gitRoot).status === 0;
}

function ensureFileBridge(projectRoot, source, destination) {
  if (isTracked(projectRoot, destination)) {
    return { ok: false, reason: `tracked path cannot be used as a local bridge: ${destination}` };
  }
  if (existsSync(destination)) {
    if (lstatSync(destination).isFile()
      && readFileSync(destination, "utf8") === readFileSync(source, "utf8")) {
      return { ok: true, changed: false };
    }
    if (lstatSync(destination).isFile() && isManagedBridge(destination)) {
      writeFileSync(destination, readFileSync(source));
      return { ok: true, changed: true };
    }
    return { ok: false, reason: `existing path conflicts with local bridge: ${destination}` };
  }
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, readFileSync(source));
  return { ok: true, changed: true };
}

function isManagedBridge(path) {
  const content = readFileSync(path, "utf8");
  if (content.startsWith("# Generated by ms init;")) return true;
  const codexLifecycleCommands = [
    'command = "ms lifecycle hook session-start --agent codex"',
    'command = "ms lifecycle hook user-prompt --agent codex"',
    'command = "ms lifecycle hook stop --agent codex"',
  ];
  if (codexLifecycleCommands.every((command) => content.includes(command))) return true;
  try {
    const parsed = JSON.parse(content);
    const sessionCommand = parsed.hooks?.SessionStart?.[0]?.hooks?.[0]?.command;
    if (sessionCommand === "ms lifecycle hook session-start --agent claude") return true;
    const memex = parsed.mcpServers?.memex;
    if (memex?.command === "ms" && memex.args?.[0] === "memory") return true;
  } catch {
    return false;
  }
  return false;
}

function ensureSkillBridge(projectRoot, source, destination) {
  if (isTracked(projectRoot, destination)) {
    return { ok: false, reason: `tracked path cannot be used as a local bridge: ${destination}` };
  }
  if (existsSync(destination)) {
    try {
      if (realpathSync(destination) === realpathSync(source)) return { ok: true, changed: false };
    } catch {
      // Fall through to the conflict report below.
    }
    return { ok: false, reason: `existing path conflicts with local bridge: ${destination}` };
  }
  const parent = dirname(destination);
  if (existsSync(parent) && !statSync(parent).isDirectory()) {
    return { ok: false, reason: `parent path is not a directory: ${parent}` };
  }
  mkdirSync(parent, { recursive: true });
  symlinkSync(resolve(source), destination, process.platform === "win32" ? "junction" : "dir");
  return { ok: true, changed: true };
}

function integrationFiles(projectRoot, instance) {
  const integrationRoot = join(instance, "integrations");
  const codexConfig = join(integrationRoot, "codex", "config.toml");
  const claudeSettings = join(integrationRoot, "claude", "settings.local.json");
  const claudeMcp = join(integrationRoot, "claude", "mcp.json");
  const projectArg = JSON.stringify(projectRoot);

  mkdirSync(dirname(codexConfig), { recursive: true });
  mkdirSync(dirname(claudeSettings), { recursive: true });
  writeFileSync(codexConfig, [
    "# Generated by ms init; canonical local Codex integration.",
    "[mcp_servers.multi_silicon_memex]",
    'command = "ms"',
    `args = ["memory", "--project", ${projectArg}, "mcp"]`,
    "",
    "[[hooks.SessionStart]]",
    'matcher = "startup|resume|clear|compact"',
    "[[hooks.SessionStart.hooks]]",
    'type = "command"',
    'command = "ms lifecycle hook session-start --agent codex"',
    "timeout = 30",
    "",
    "[[hooks.UserPromptSubmit]]",
    "[[hooks.UserPromptSubmit.hooks]]",
    'type = "command"',
    'command = "ms lifecycle hook user-prompt --agent codex"',
    "timeout = 30",
    "",
    "[[hooks.Stop]]",
    "[[hooks.Stop.hooks]]",
    'type = "command"',
    'command = "ms lifecycle hook stop --agent codex"',
    "timeout = 30",
    "",
  ].join("\n"), "utf8");

  writeFileSync(claudeSettings, `${JSON.stringify({
    hooks: {
      SessionStart: [{
        matcher: "startup|resume|clear|compact",
        hooks: [{ type: "command", command: "ms lifecycle hook session-start --agent claude", timeout: 30 }],
      }],
      UserPromptSubmit: [{
        hooks: [{ type: "command", command: "ms lifecycle hook user-prompt --agent claude", timeout: 30 }],
      }],
      Stop: [{
        hooks: [{ type: "command", command: "ms lifecycle hook stop --agent claude", timeout: 30 }],
      }],
    },
  }, null, 2)}\n`, "utf8");

  writeFileSync(claudeMcp, `${JSON.stringify({
    mcpServers: {
      memex: { type: "stdio", command: "ms", args: ["memory", "--project", projectRoot, "mcp"] },
    },
  }, null, 2)}\n`, "utf8");

  return { codexConfig, claudeSettings, claudeMcp };
}

function installLocalIntegrations(projectRoot, instance) {
  copyMissing(packagedSkillsRoot, join(instance, "integrations", "skills"));
  const canonical = integrationFiles(projectRoot, instance);
  const skill = join(instance, "integrations", "skills", "multi-silicon-memory");
  const bridges = [
    { path: join(projectRoot, ".codex", "config.toml"), source: canonical.codexConfig, kind: "file", required: true },
    { path: join(projectRoot, ".claude", "settings.local.json"), source: canonical.claudeSettings, kind: "file", required: true },
    { path: join(projectRoot, ".mcp.json"), source: canonical.claudeMcp, kind: "file", required: true },
    { path: join(projectRoot, ".agents", "skills", "multi-silicon-memory"), source: skill, kind: "skill", required: false },
    { path: join(projectRoot, ".claude", "skills", "multi-silicon-memory"), source: skill, kind: "skill", required: false },
  ];
  const results = bridges.map((bridge) => ({
    ...bridge,
    result: bridge.kind === "file"
      ? ensureFileBridge(projectRoot, bridge.source, bridge.path)
      : ensureSkillBridge(projectRoot, bridge.source, bridge.path),
  }));
  return { canonical, bridges: results };
}

function findInstance(startPath) {
  let cursor = resolve(startPath);
  if (existsSync(cursor) && !statSync(cursor).isDirectory()) {
    cursor = dirname(cursor);
  }

  while (true) {
    const instance = join(cursor, ".multi-silicon");
    if (existsSync(join(instance, "config.yaml"))) {
      return { projectRoot: cursor, instance };
    }
    const parent = dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
}

function initProject(target, io) {
  const projectRoot = resolve(target ?? ".");
  if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
    return fail(`target directory does not exist: ${projectRoot}`, io);
  }
  if (!existsSync(templateRoot)) {
    return fail(`project template is missing: ${templateRoot}`, io);
  }

  const instance = join(projectRoot, ".multi-silicon");
  const created = !existsSync(instance);
  copyMissing(templateRoot, instance);
  replaceTokens(instance, {
    "{{FRAMEWORK_VERSION}}": frameworkVersion,
    "{{CREATED_DATE}}": new Date().toISOString().slice(0, 10),
  });

  const integrations = installLocalIntegrations(projectRoot, instance);
  const excludeEntries = [
    { path: instance, directory: true },
    ...integrations.bridges
      .filter((bridge) => bridge.result.ok)
      .map((bridge) => ({ path: bridge.path, directory: bridge.kind === "skill" })),
  ];
  const exclude = addLocalGitExcludes(projectRoot, excludeEntries);
  output(created ? `Created ${instance}` : `Project instance already exists: ${instance}`, io);
  for (const pattern of exclude.patterns) output(`Local Git exclude: ${pattern}`, io);
  if (exclude.reason === "not-a-git-repository") {
    output("Git exclude skipped: target is not inside a Git repository.", io);
  }
  output("Agent trust: review and trust this project's local config and hooks when Codex or Claude prompts.", io);
  const conflicts = integrations.bridges.filter((bridge) => !bridge.result.ok);
  for (const bridge of conflicts) {
    output(`${bridge.required ? "✗" : "~"} ${bridge.result.reason}${bridge.required ? "" : "; lifecycle Hook remains active"}`, io);
  }
  return conflicts.some((bridge) => bridge.required) ? 1 : 0;
}

function statusProject(target, io) {
  const found = findInstance(target ?? ".");
  if (!found) return fail("no .multi-silicon project instance found", io);
  output(`Project: ${found.projectRoot}`, io);
  output(`Instance: ${found.instance}`, io);
  output(`Memory: ${join(found.instance, "memory")}`, io);
  output(`Agent integrations: ${join(found.instance, "integrations")}`, io);
  return 0;
}

function doctorProject(target, io) {
  const found = findInstance(target ?? ".");
  if (!found) return fail("no .multi-silicon project instance found", io);

  const checks = [
    ["config", join(found.instance, "config.yaml")],
    ["memory config", join(found.instance, "memory", ".memexrc")],
    ["memory cards", join(found.instance, "memory", "cards")],
    ["Memory Skill", join(found.instance, "integrations", "skills", "multi-silicon-memory", "SKILL.md")],
    ["Codex bridge", join(found.projectRoot, ".codex", "config.toml")],
    ["Claude bridge", join(found.projectRoot, ".claude", "settings.local.json")],
    ["Claude MCP bridge", join(found.projectRoot, ".mcp.json")],
  ];
  let ok = true;
  for (const [label, path] of checks) {
    const present = existsSync(path);
    output(`${present ? "✓" : "✗"} ${label}: ${path}`, io);
    ok &&= present;
  }

  const memex = resolveMemexRunner();
  const memexPresent = memex !== null;
  output(`${memexPresent ? "✓" : "✗"} Memex: ${memexPresent ? `${memex.version} (${memex.source})` : "provider not found"}`, io);
  ok &&= memexPresent;
  for (const [label, path] of [
    ["Codex Skill bridge (optional)", join(found.projectRoot, ".agents", "skills", "multi-silicon-memory", "SKILL.md")],
    ["Claude Skill bridge (optional)", join(found.projectRoot, ".claude", "skills", "multi-silicon-memory", "SKILL.md")],
  ]) {
    output(`${existsSync(path) ? "✓" : "~"} ${label}: ${path}`, io);
  }
  output("i Agent trust: project config and command hooks must be accepted in each host before they can run.", io);
  return ok ? 0 : 1;
}

function takeOption(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return { args, value: undefined };
  const value = args[index + 1];
  if (value === undefined) return { args, value: null };
  return { args: [...args.slice(0, index), ...args.slice(index + 2)], value };
}

function memoryCommand(inputArgs, target, io) {
  const projectOption = takeOption(inputArgs, "--project");
  if (projectOption.value === null) return fail("--project requires a path", io);
  const args = projectOption.args;
  if (args.length === 0) return fail("provide a native Memex command", io);
  if (["recall", "retro"].includes(args[0])) {
    return fail(`'${args[0]}' is an Agent lifecycle operation, not a native Memex command`, io);
  }
  const found = findInstance(projectOption.value ?? target ?? ".");
  if (!found) return fail("no .multi-silicon project instance found", io);
  const memex = resolveMemexRunner();
  if (!memex) return fail("Memex provider not found; install @touchskyer/memex or set MS_MEMEX_CLI", io);
  const result = spawnSync(memex.command, [...memex.prefixArgs, ...args], {
    cwd: found.projectRoot,
    env: { ...process.env, MEMEX_HOME: join(found.instance, "memory") },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) return fail(result.error.message, io);
  return result.status ?? 1;
}

function parseLifecycleArgs(args) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const name = token.slice(2);
    if (name === "verified") {
      options[name] = true;
      continue;
    }
    options[name] = args[index + 1];
    index += 1;
  }
  return { options, positionals };
}

function safeSessionId(sessionId) {
  return sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function sessionPath(instance, sessionId) {
  return join(instance, "state", "memory-sessions", `${safeSessionId(sessionId)}.json`);
}

function readSession(instance, sessionId) {
  const path = sessionPath(instance, sessionId);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeSession(instance, state) {
  const path = sessionPath(instance, state.sessionId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function hookInput(io) {
  const raw = io.stdinText ?? readFileSync(0, "utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}

function lifecycleContext(sessionId) {
  return [
    "Multi-Silicon Memory lifecycle is active for this project.",
    `Session: ${sessionId}`,
    "Before substantive work, decide whether history can change the approach. Run 1-3 focused Memex queries when useful; otherwise explicitly treat Recall as skipped.",
    "Use the project MCP provider multi_silicon_memex when available, otherwise use ms memory. Never use a Memex provider configured for another project.",
    "Treat memory as context; current source, tests, project rules, and live evidence win.",
    "Before the final response, perform Retro. Search/read candidates before create or update, write one durable insight per card, and reread any write. If no durable insight exists, choose skip.",
    "End the final response with: 记忆：创建|更新|跳过 — <原因>. Memory/Protocol does not require an Agent-side shell receipt; mechanical attestation belongs to Harness.",
  ].join("\n");
}

function lifecycleHook(args, io) {
  const { options, positionals } = parseLifecycleArgs(args);
  const event = positionals[0];
  const agent = options.agent;
  if (!event || !["session-start", "user-prompt", "stop"].includes(event)) {
    return fail("hook requires session-start, user-prompt, or stop", io);
  }
  if (!agent || !["codex", "claude"].includes(agent)) return fail("--agent must be codex or claude", io);
  const found = findInstance(options.project ?? ".");
  if (!found) return fail("no .multi-silicon project instance found", io);
  let input;
  try {
    input = hookInput(io);
  } catch (error) {
    return fail(`invalid hook input: ${error.message}`, io);
  }
  const sessionId = input.session_id ?? input.sessionId;
  if (!sessionId) return fail("hook input is missing session_id", io);

  if (["session-start", "user-prompt"].includes(event)) {
    const existing = event === "session-start" ? readSession(found.instance, sessionId) : null;
    const state = existing ?? {
      sessionId,
      agent,
      startedAt: new Date().toISOString(),
      turnId: input.turn_id ?? input.turnId ?? null,
      recall: null,
      retro: null,
      stopPrompts: 0,
    };
    writeSession(found.instance, state);
    output(lifecycleContext(sessionId), io);
    return 0;
  }

  const state = readSession(found.instance, sessionId);
  if (state?.retro) return 0;

  const nextState = state ?? {
    sessionId,
    agent,
    startedAt: new Date().toISOString(),
    recall: null,
    retro: null,
    stopPrompts: 0,
  };
  nextState.stopPrompts += 1;
  writeSession(found.instance, nextState);
  if (nextState.stopPrompts > 1 || input.stop_hook_active === true) {
    const warning = "Multi-Silicon allowed stop after one Retro reminder; Harness-level attestation is not enabled.";
    if (agent === "codex") output(JSON.stringify({ systemMessage: warning }), io);
    else io.stderr.write(`${warning}\n`);
    return 0;
  }

  const prompt = `Multi-Silicon completion reminder for session ${sessionId}: perform Retro before finishing. Use project Memory to create or update only durable knowledge; otherwise choose skip. End the response with 记忆：创建|更新|跳过 — <原因>. No lifecycle shell receipt is required.`;
  if (agent === "claude") {
    io.stderr.write(`${prompt}\n`);
    return 2;
  }
  output(JSON.stringify({ decision: "block", reason: prompt }), io);
  return 0;
}

function lifecycleRecord(kind, args, io) {
  const { options } = parseLifecycleArgs(args);
  const found = findInstance(options.project ?? ".");
  if (!found) return fail("no .multi-silicon project instance found", io);
  if (!options.session) return fail("--session is required", io);
  if (!options.reason) return fail("--reason is required", io);
  const allowed = kind === "recall" ? ["performed", "skipped"] : ["create", "update", "skip"];
  if (!allowed.includes(options.action)) return fail(`--action must be ${allowed.join(" or ")}`, io);
  if (kind === "retro" && ["create", "update"].includes(options.action) && !options.verified) {
    return fail("--verified is required after creating or updating Memory", io);
  }
  const state = readSession(found.instance, options.session);
  if (!state) return fail(`unknown lifecycle session: ${options.session}`, io);
  state[kind] = {
    action: options.action,
    reason: options.reason,
    verified: kind === "retro" ? Boolean(options.verified) : undefined,
    recordedAt: new Date().toISOString(),
  };
  writeSession(found.instance, state);
  output(`Recorded ${kind}: ${options.action}`, io);
  return 0;
}

function lifecycleCommand(args, io) {
  const [command, ...rest] = args;
  if (command === "hook") return lifecycleHook(rest, io);
  if (command === "recall") return lifecycleRecord("recall", rest, io);
  if (command === "retro") return lifecycleRecord("retro", rest, io);
  return fail("lifecycle requires hook, recall, or retro", io);
}

export async function main(args, io = { stdout: process.stdout, stderr: process.stderr }) {
  const [command = "help", ...rest] = args;
  if (["help", "--help", "-h"].includes(command)) {
    output(help.trimEnd(), io);
    return 0;
  }
  if (["--version", "-V", "version"].includes(command)) {
    output(frameworkVersion, io);
    return 0;
  }
  if (command === "init") return initProject(rest[0], io);
  if (command === "status") return statusProject(rest[0], io);
  if (command === "doctor") return doctorProject(rest[0], io);
  if (command === "memory") return memoryCommand(rest, ".", io);
  if (command === "lifecycle") return lifecycleCommand(rest, io);
  return fail(`unknown command '${command}'\n\n${help}`, io);
}
