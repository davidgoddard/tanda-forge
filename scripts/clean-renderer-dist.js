const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const rendererDistDir = path.join(rootDir, "dist", "renderer");

fs.rmSync(rendererDistDir, { recursive: true, force: true });
