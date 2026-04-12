#!/usr/bin/env node

const path = require("path");
const Database = require("better-sqlite3");

const loadSharedModule = (relativePath) => {
  try {
    return require(path.resolve(__dirname, "..", "dist", "shared", relativePath));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to load built helper module dist/shared/${relativePath}. Run "npm run build" first. (${message})`,
    );
  }
};

const {
  hasAppendedInstrumentalMarker,
  stripAppendedInstrumentalMarker,
} = loadSharedModule("instrumental-marker-cleanup.js");
const { summarizeArtistName } = loadSharedModule("tanda-utils.js");

const parseArgs = (argv) => {
  const args = {
    dbPath: "",
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--db") {
      args.dbPath = argv[index + 1] ? path.resolve(argv[index + 1]) : "";
      index += 1;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
};

const usage = () => {
  console.log(
    [
      "Usage:",
      "  node scripts/repair-instrumental-markers.js --db /path/to/tanda-player.db [--dry-run]",
      "",
      "Scans track title/artist fields for a trailing 'instrumental' marker, strips it,",
      "clears singer, and marks the track as instrumental.",
    ].join("\n"),
  );
};

const collectUpdates = (rows) => {
  const updates = [];
  rows.forEach((row) => {
    const titleResult = stripAppendedInstrumentalMarker(row.title);
    const artistResult = stripAppendedInstrumentalMarker(row.artist);
    const matchedTitle = hasAppendedInstrumentalMarker(row.title);
    const matchedArtist = hasAppendedInstrumentalMarker(row.artist);
    if (!matchedTitle && !matchedArtist) {
      return;
    }
    const nextArtist = artistResult.value;
    updates.push({
      id: row.id,
      title: titleResult.value || null,
      artist: nextArtist || null,
      artistSummary: nextArtist ? summarizeArtistName(nextArtist) : null,
      singer: null,
      instrumental: 1,
      matchedTitle,
      matchedArtist,
      beforeTitle: row.title,
      beforeArtist: row.artist,
      afterTitle: titleResult.value,
      afterArtist: artistResult.value,
    });
  });
  return updates;
};

const applyUpdates = (db, updates) => {
  const now = new Date().toISOString();
  const updateStmt = db.prepare(`
    update tracks
    set title = ?,
        artist = ?,
        artist_summary = ?,
        singer = ?,
        instrumental = ?,
        updated_at = ?
    where id = ?
  `);
  const run = db.transaction((rows) => {
    rows.forEach((row) => {
      updateStmt.run(
        row.title,
        row.artist,
        row.artistSummary,
        row.singer,
        row.instrumental,
        now,
        row.id,
      );
    });
  });
  run(updates);
};

const printSummary = (updates, dryRun) => {
  const titleMatches = updates.filter((row) => row.matchedTitle).length;
  const artistMatches = updates.filter((row) => row.matchedArtist).length;
  const modeLabel = dryRun ? "Dry run" : "Updated";
  console.log(
    `${modeLabel}: ${updates.length} tracks (${titleMatches} title matches, ${artistMatches} artist matches).`,
  );
  updates.slice(0, 20).forEach((row) => {
    console.log(
      `- ${row.id}: title "${row.beforeTitle ?? ""}" -> "${row.afterTitle}", artist "${row.beforeArtist ?? ""}" -> "${row.afterArtist}"`,
    );
  });
  if (updates.length > 20) {
    console.log(`...and ${updates.length - 20} more`);
  }
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (!args.dbPath) {
    usage();
    throw new Error("Missing required --db argument.");
  }
  const db = new Database(args.dbPath);
  try {
    const rows = db
      .prepare("select id, title, artist from tracks")
      .all();
    const updates = collectUpdates(rows);
    printSummary(updates, args.dryRun);
    if (!args.dryRun && updates.length > 0) {
      applyUpdates(db, updates);
    }
  } finally {
    db.close();
  }
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  collectUpdates,
  parseArgs,
};
