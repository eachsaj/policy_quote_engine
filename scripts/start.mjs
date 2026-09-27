// Runs `npm start` in backend/ and frontend/ side by side with prefixed output.
// Installs a package's dependencies first if node_modules is missing.
// Ctrl+C, or either service exiting, stops both. No dependencies.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const services = [
  { name: "backend ", dir: "backend", colour: "\x1b[36m" },
  { name: "frontend", dir: "frontend", colour: "\x1b[35m" },
];

for (const { dir } of services) {
  const cwd = join(root, dir);
  if (!existsSync(join(cwd, "node_modules"))) {
    console.log(`Installing ${dir} dependencies...`);
    const { status } = spawnSync(npm, ["ci"], { cwd, stdio: "inherit" });
    if (status !== 0) process.exit(status ?? 1);
  }
}

const children = [];
let stopping = false;

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  process.exitCode = code;
}

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

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stopAll(0));
