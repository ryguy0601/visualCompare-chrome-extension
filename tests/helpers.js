/**
 * Shared test helpers.
 * The studio controller is split across studio/*.js (classic scripts sharing one
 * global scope). Tests that assert on its source read all modules, in the load
 * order declared in studio.html, joined into one string.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

/** Module file names (relative to root) in the order studio.html loads them. */
function studioModulePaths() {
  const html = fs.readFileSync(path.join(root, "studio.html"), "utf8");
  return [...html.matchAll(/<script src="(studio\/[^"]+\.js)"/g)].map((m) => m[1]);
}

/**
 * Full studio controller source (all modules in load order).
 *
 * Many tests extract functions with regexes that expect the original single-file
 * layout (everything indented two spaces inside one DOMContentLoaded handler), so
 * the modules' top-level code is re-indented and wrapped the same way. The
 * per-file header comments are dropped.
 */
function readStudioJs() {
  const body = studioModulePaths()
    .map((p) => fs.readFileSync(path.join(root, p), "utf8").replace(/^\/\*\*[\s\S]*?\*\/\s*/, "").trimEnd())
    .join("\n\n")
    .split("\n")
    .map((line) => (line.trim() ? "  " + line : line))
    .join("\n");
  return 'document.addEventListener("DOMContentLoaded", () => {\n' + body + "\n});\n";
}

module.exports = { root, studioModulePaths, readStudioJs };
