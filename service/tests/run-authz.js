// Runs every test file in tests/authz/ with the built-in test runner.
//
// This exists because `node --test` does not take the same arguments on
// every Node version:
//
//   * Node 20 (what CI runs) accepts a directory, but NOT a glob pattern.
//     Given "tests/authz/**/*.test.js" it treats the string as a literal
//     path and exits with MODULE_NOT_FOUND.
//   * Node 22+ accepts a glob, but rejects the bare directory form.
//
// A package.json script written for either one breaks on the other, and it
// breaks by failing to find any tests — which looks exactly like a test
// failure while actually meaning nothing ran. Resolving the file list here
// makes the command behave the same everywhere, and adding a new test file
// needs no change to package.json.

const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const directory = join(__dirname, "authz");

const files = readdirSync(directory)
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => join(directory, name));

if (files.length === 0) {
  console.error(`no test files found in ${directory}`);
  process.exit(1);
}

console.log(`running ${files.length} authorisation test files`);

const result = spawnSync(
  process.execPath,
  ["--test", ...process.argv.slice(2), ...files],
  { stdio: "inherit" }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
