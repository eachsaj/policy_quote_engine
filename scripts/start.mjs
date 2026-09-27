// Runs `npm start` in backend/ and frontend/ side by side with prefixed output.
// Installs a package's dependencies first if node_modules is missing.
// Ctrl+C, or either service exiting, stops both. No dependencies.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The repo root, one level above this script. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/** npm's executable name differs on Windows. */
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
/** The two services, each started with its own `npm start`. Names are padded so the prefixes line up. */
const services = [
  { name: "backend ", dir: "backend", colour: "\x1b[36m" },
  { name: "frontend", dir: "frontend", colour: "\x1b[35m" },
];

// First run: install each package's locked dependencies before starting anything.
for (const { dir } of services) {
  const cwd = join(root, dir);
  if (!existsSync(join(cwd, "node_modules"))) {
    console.log(`Installing ${dir} dependencies...`);
    const { status } = spawnSync(npm, ["ci"], { cwd, stdio: "inherit" });
    if (status !== 0) process.exit(status ?? 1);
  }
}

/** The running service processes. */
const children = [];
/** Set once shutdown starts, so the second child's exit doesn't trigger another shutdown. */
let stopping = false;

/** Stops every service that is still running, and exits with `code` once they have gone. */
function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  process.exitCode = code;
}

/**
 * Copies a child's output to this terminal line by line, each line prefixed with the service name.
 * Partial lines are held until they end, so output from the two services never interleaves mid-line.
 */
function pipe(stream, prefix) {
  let buffered = "";
  stream.on("data", (chunk) => {
    buffered += chunk;
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) process.stdout.write(`${prefix}${line}\n`);
  });
  stream.on("end", () => buffered && process.stdout.write(`${prefix}${buffered}\n`));
}

// Start both services. If either exits (a crash, or a port already in use), stop the other too.
for (const { name, dir, colour } of services) {
  const child = spawn(npm, ["start"], { cwd: join(root, dir), env: { ...process.env, FORCE_COLOR: "1" } });
  const prefix = `${colour}[${name}]\x1b[0m `;
  pipe(child.stdout, prefix);
  pipe(child.stderr, prefix);
  child.on("exit", (code) => {
    if (!stopping) console.log(`${prefix}exited with code ${code}; stopping the other service.`);
    stopAll(code ?? 0);
  });
  children.push(child);
}

// Ctrl+C (SIGINT) or a kill (SIGTERM) stops both services cleanly.
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stopAll(0));
