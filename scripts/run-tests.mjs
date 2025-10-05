#!/usr/bin/env node

import { spawn } from "node:child_process";

const args = process.argv.slice(2);

const knownModes = new Set(["run", "watch", "ui"]);
const mode = knownModes.has(args[0] ?? "") ? (args.shift() ?? "run") : "run";

let selection = "default";
const forwardArgs = [];

for (const arg of args) {
  if (arg === "--fli") {
    selection = "fli";
  } else if (arg === "--all") {
    selection = "all";
  } else {
    forwardArgs.push(arg);
  }
}

const vitestArgs = [];

if (mode === "ui") {
  vitestArgs.push("--ui");
} else {
  vitestArgs.push(mode);
}

if (selection === "default") {
  vitestArgs.push("--project", "default");
} else if (selection === "fli") {
  vitestArgs.push("--project", "fli");
} else {
  vitestArgs.push("--project", "default", "--project", "fli");
}

vitestArgs.push(...forwardArgs);

const child = spawn("bunx", ["vitest", ...vitestArgs], {
  stdio: "inherit",
  env: {
    ...process.env,
    VITEST_SELECTION: selection,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
