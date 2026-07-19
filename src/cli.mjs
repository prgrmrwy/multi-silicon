import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = join(packageRoot, "templates", "project-instance", ".multi-silicon");
const frameworkVersion = "0.1.0";
const memexPackagePath = join("@touchskyer", "memex", "dist", "cli.js");

const help = `Multi-Silicon CLI

Usage:
  ms init [path]       Create a local .multi-silicon project instance
  ms status [path]     Show the nearest project instance
  ms doctor [path]     Validate the project instance and dependencies
  ms memory <args...>  Run a native Memex command for this project instance
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

function addLocalGitExclude(projectRoot) {
  const topLevelResult = git(["rev-parse", "--show-toplevel"], projectRoot);
  if (topLevelResult.status !== 0) {
    return { changed: false, reason: "not-a-git-repository" };
  }

  const gitRoot = resolve(topLevelResult.stdout.trim());
  const excludeResult = git(["rev-parse", "--git-path", "info/exclude"], projectRoot);
  if (excludeResult.status !== 0) {
    return { changed: false, reason: "git-exclude-unavailable" };
  }

  const excludePath = resolve(projectRoot, excludeResult.stdout.trim());
  const instanceRelative = relative(gitRoot, join(projectRoot, ".multi-silicon"))
    .replaceAll("\\", "/");
  const pattern = `/${instanceRelative}/`.replace("//", "/");
  const current = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";
  const lines = current.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(pattern)) {
    return { changed: false, reason: "already-excluded", pattern };
  }

  mkdirSync(dirname(excludePath), { recursive: true });
  const prefix = current.length === 0 || current.endsWith("\n") ? "" : "\n";
  appendFileSync(excludePath, `${prefix}# Multi-Silicon local project instance\n${pattern}\n`, "utf8");
  return { changed: true, pattern };
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

  const exclude = addLocalGitExclude(projectRoot);
  output(created ? `Created ${instance}` : `Project instance already exists: ${instance}`, io);
  if (exclude.pattern) output(`Local Git exclude: ${exclude.pattern}`, io);
  if (exclude.reason === "not-a-git-repository") {
    output("Git exclude skipped: target is not inside a Git repository.", io);
  }
  return 0;
}

function statusProject(target, io) {
  const found = findInstance(target ?? ".");
  if (!found) return fail("no .multi-silicon project instance found", io);
  output(`Project: ${found.projectRoot}`, io);
  output(`Instance: ${found.instance}`, io);
  output(`Memory: ${join(found.instance, "memory")}`, io);
  return 0;
}

function doctorProject(target, io) {
  const found = findInstance(target ?? ".");
  if (!found) return fail("no .multi-silicon project instance found", io);

  const checks = [
    ["config", join(found.instance, "config.yaml")],
    ["memory config", join(found.instance, "memory", ".memexrc")],
    ["memory cards", join(found.instance, "memory", "cards")],
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
  return ok ? 0 : 1;
}

function memoryCommand(args, target, io) {
  if (args.length === 0) return fail("provide a native Memex command", io);
  if (["recall", "retro"].includes(args[0])) {
    return fail(`'${args[0]}' is an Agent lifecycle operation, not a native Memex command`, io);
  }
  const found = findInstance(target ?? ".");
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
  return fail(`unknown command '${command}'\n\n${help}`, io);
}
