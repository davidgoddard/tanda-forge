const fs = require("fs");
const path = require("path");

// Copy the optional BPM engine's native ESM sources into the packaged app.
const bpmSource = path.join(__dirname, "../app/src/main/bpm/analyzer");
const bpmTarget = path.join(__dirname, "../dist/main/bpm/analyzer");
fs.mkdirSync(bpmTarget, { recursive: true });
for (const name of fs.readdirSync(bpmSource)) {
  fs.copyFileSync(path.join(bpmSource, name), path.join(bpmTarget, name));
}

const rootDir = path.join(__dirname, "..");
const srcDir = path.join(rootDir, "app", "src", "renderer");
const distDir = path.join(rootDir, "dist", "renderer");

fs.mkdirSync(distDir, { recursive: true });

[
  "index.html",
  "styles.css",
  "display.html",
  "display.css",
  "display.js",
  "manual-audio-route-test.html",
  "manual-audio-route-test.css",
].forEach(
  (fileName) => {
    fs.copyFileSync(path.join(srcDir, fileName), path.join(distDir, fileName));
  },
);
