const fs = require("fs");
const path = require("path");

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
