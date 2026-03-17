#!/usr/bin/env node

/**
 * Pulls the live /data/workspace/ contents from Railway down to the local
 * openclaw-workspace directory. Handles the files Wade creates and edits
 * at runtime (RULES.md, IDENTITY.md, memory/, etc.) as well as any new
 * files that appear on the container.
 *
 * Usage:
 *   node sync-from-railway.mjs           # sync workspace docs (skip plugin)
 *   node sync-from-railway.mjs --all     # sync everything including plugin
 *   node sync-from-railway.mjs --list    # just list remote files, don't sync
 */

import { execSync } from "child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { dirname, join, posix } from "path";

const SERVICE = "OpenClaw Main";
const REMOTE_ROOT = "/data/workspace";
const LOCAL_ROOT = process.cwd();

const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const syncAll = args.includes("--all");

function ssh(cmd) {
  try {
    const result = execSync(
      `railway ssh -s "${SERVICE}" -- "${cmd.replace(/"/g, '\\"')}"`,
      { encoding: "utf-8", timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] }
    );
    return result.trim();
  } catch (err) {
    if (err.stderr?.includes("No linked project")) {
      console.error(
        "\nRailway project not linked. Run: railway link\n" +
          "Select project f305b857 / environment production / service OpenClaw Main\n"
      );
      process.exit(1);
    }
    // railway ssh often returns non-zero exit codes even on success
    if (err.stdout && err.stdout.trim().length > 0) {
      return err.stdout.trim();
    }
    throw err;
  }
}

console.log("Connecting to Railway...\n");

const fileList = ssh(
  `find ${REMOTE_ROOT} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | sort`
);

if (!fileList) {
  console.log("No files found on Railway at", REMOTE_ROOT);
  process.exit(0);
}

const remoteFiles = fileList.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

const skipPatterns = syncAll
  ? []
  : ["/extensions/wade-tools/"];

const BINARY_EXTENSIONS = [
  ".mp3", ".ogg", ".wav", ".mp4", ".webm",
  ".zip", ".tar", ".gz",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
  ".pdf", ".docx", ".xlsx", ".pptx",
];

const filesToSync = remoteFiles.filter((f) => {
  const rel = f.replace(REMOTE_ROOT + "/", "");
  if (!syncAll && skipPatterns.some((p) => rel.includes(p.slice(1)))) return false;
  if (rel.endsWith(".d.ts") || rel.endsWith(".js.map")) return false;
  const lower = rel.toLowerCase();
  if (BINARY_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
  return true;
});

console.log(
  `Found ${remoteFiles.length} files on Railway` +
    (skipPatterns.length ? ` (syncing ${filesToSync.length}, skipping plugin)` : "") +
    "\n"
);

if (listOnly) {
  for (const f of remoteFiles) {
    const rel = f.replace(REMOTE_ROOT + "/", "");
    const skipped = !filesToSync.includes(f);
    console.log(`  ${skipped ? "(skip) " : "       "}${rel}`);
  }
  process.exit(0);
}

let synced = 0;
let unchanged = 0;
let created = 0;

for (const remotePath of filesToSync) {
  const relPath = remotePath.replace(REMOTE_ROOT + "/", "");
  const localPath = join(LOCAL_ROOT, relPath);

  try {
    const remoteContent = ssh(`cat '${remotePath}'`);

    let status = "updated";
    if (existsSync(localPath)) {
      const localContent = readFileSync(localPath, "utf-8").replace(/\r\n/g, "\n");
      if (localContent.trim() === remoteContent.trim()) {
        unchanged++;
        continue;
      }
    } else {
      status = "new";
      created++;
    }

    mkdirSync(dirname(localPath), { recursive: true });
    writeFileSync(localPath, remoteContent + "\n", "utf-8");

    const icon = status === "new" ? "+" : "~";
    console.log(`  ${icon} ${relPath}`);
    synced++;
  } catch (err) {
    console.error(`  ! ${relPath} — failed: ${err.message?.split("\n")[0]}`);
  }
}

console.log(
  `\nDone. ${synced} updated, ${created} new, ${unchanged} unchanged.`
);

if (synced > 0) {
  console.log("\nReview changes with: git diff");
  console.log("Commit with: git add -A && git commit -m \"sync from Railway\"");
}
