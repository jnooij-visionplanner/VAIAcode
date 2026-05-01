#!/usr/bin/env node
// Regenerate every icon/PNG/ICO/ICNS used by the apps from `assets/prod/logo.svg`.
//
// Run with:
//   node scripts/regen-brand-icons.mjs
//
// Requires macOS (uses `sips` for SVG rasterization and `iconutil` for .icns).
// No external Node dependencies — the ICO encoder is inlined below.

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const SOURCE_SVG = join(REPO, "assets/prod/logo.svg");

const work = mkdtempSync(join(tmpdir(), "vaia-icons-"));

function renderPng(size, outPath) {
  execFileSync(
    "sips",
    ["-s", "format", "png", "-z", String(size), String(size), SOURCE_SVG, "--out", outPath],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
}

const SIZES = [16, 32, 48, 64, 128, 180, 256, 512, 1024];
const pngBySize = new Map();
for (const size of SIZES) {
  const p = join(work, `vaia-${size}.png`);
  renderPng(size, p);
  pngBySize.set(size, p);
}

// Encode an ICO file from a list of {size, pngPath} entries.
// Uses PNG-compressed entries (supported on Vista+ and all modern browsers).
function encodeIco(entries) {
  const count = entries.length;
  const headerLen = 6;
  const dirEntryLen = 16;
  const dirLen = count * dirEntryLen;
  const pngBuffers = entries.map((e) => readFileSync(e.pngPath));
  const totalImageLen = pngBuffers.reduce((sum, b) => sum + b.length, 0);
  const totalLen = headerLen + dirLen + totalImageLen;
  const buf = Buffer.alloc(totalLen);
  let off = 0;
  buf.writeUInt16LE(0, off);
  off += 2;
  buf.writeUInt16LE(1, off);
  off += 2;
  buf.writeUInt16LE(count, off);
  off += 2;
  let imageOffset = headerLen + dirLen;
  for (let i = 0; i < count; i++) {
    const e = entries[i];
    const png = pngBuffers[i];
    const w = e.size >= 256 ? 0 : e.size;
    const h = e.size >= 256 ? 0 : e.size;
    buf.writeUInt8(w, off);
    off += 1;
    buf.writeUInt8(h, off);
    off += 1;
    buf.writeUInt8(0, off);
    off += 1;
    buf.writeUInt8(0, off);
    off += 1;
    buf.writeUInt16LE(1, off);
    off += 2;
    buf.writeUInt16LE(32, off);
    off += 2;
    buf.writeUInt32LE(png.length, off);
    off += 4;
    buf.writeUInt32LE(imageOffset, off);
    off += 4;
    imageOffset += png.length;
  }
  let dataOff = headerLen + dirLen;
  for (const png of pngBuffers) {
    png.copy(buf, dataOff);
    dataOff += png.length;
  }
  return buf;
}

function writeIco(outPath, sizes) {
  const entries = sizes.map((s) => ({ size: s, pngPath: pngBySize.get(s) }));
  writeFileSync(outPath, encodeIco(entries));
}

function writeIcns(outPath) {
  const iconset = join(work, "vaia.iconset");
  mkdirSync(iconset, { recursive: true });
  const map = [
    [16, "icon_16x16.png"],
    [32, "icon_16x16@2x.png"],
    [32, "icon_32x32.png"],
    [64, "icon_32x32@2x.png"],
    [128, "icon_128x128.png"],
    [256, "icon_128x128@2x.png"],
    [256, "icon_256x256.png"],
    [512, "icon_256x256@2x.png"],
    [512, "icon_512x512.png"],
    [1024, "icon_512x512@2x.png"],
  ];
  for (const [size, name] of map) {
    copyFileSync(pngBySize.get(size), join(iconset, name));
  }
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", outPath], { stdio: "inherit" });
}

// assets/prod
copyFileSync(pngBySize.get(1024), join(REPO, "assets/prod/black-ios-1024.png"));
copyFileSync(pngBySize.get(1024), join(REPO, "assets/prod/black-macos-1024.png"));
copyFileSync(pngBySize.get(1024), join(REPO, "assets/prod/black-universal-1024.png"));
copyFileSync(pngBySize.get(180), join(REPO, "assets/prod/t3-black-web-apple-touch-180.png"));
copyFileSync(pngBySize.get(16), join(REPO, "assets/prod/t3-black-web-favicon-16x16.png"));
copyFileSync(pngBySize.get(32), join(REPO, "assets/prod/t3-black-web-favicon-32x32.png"));
writeIco(join(REPO, "assets/prod/t3-black-web-favicon.ico"), [16, 32, 48]);
writeIco(join(REPO, "assets/prod/t3-black-windows.ico"), [16, 32, 48, 256]);

// assets/nightly + assets/dev (file names retained so existing build scripts keep working)
for (const variant of ["nightly", "dev"]) {
  copyFileSync(pngBySize.get(1024), join(REPO, `assets/${variant}/blueprint-ios-1024.png`));
  copyFileSync(pngBySize.get(1024), join(REPO, `assets/${variant}/blueprint-macos-1024.png`));
  copyFileSync(pngBySize.get(1024), join(REPO, `assets/${variant}/blueprint-universal-1024.png`));
  copyFileSync(
    pngBySize.get(180),
    join(REPO, `assets/${variant}/blueprint-web-apple-touch-180.png`),
  );
  copyFileSync(pngBySize.get(16), join(REPO, `assets/${variant}/blueprint-web-favicon-16x16.png`));
  copyFileSync(pngBySize.get(32), join(REPO, `assets/${variant}/blueprint-web-favicon-32x32.png`));
  writeIco(join(REPO, `assets/${variant}/blueprint-web-favicon.ico`), [16, 32, 48]);
  writeIco(join(REPO, `assets/${variant}/blueprint-windows.ico`), [16, 32, 48, 256]);
}

// Runtime web/marketing public dirs.
for (const target of [join(REPO, "apps/web/public"), join(REPO, "apps/marketing/public")]) {
  copyFileSync(pngBySize.get(180), join(target, "apple-touch-icon.png"));
  copyFileSync(pngBySize.get(16), join(target, "favicon-16x16.png"));
  copyFileSync(pngBySize.get(32), join(target, "favicon-32x32.png"));
  writeIco(join(target, "favicon.ico"), [16, 32, 48]);
}
copyFileSync(pngBySize.get(512), join(REPO, "apps/marketing/public/icon.png"));

// Desktop launcher icons.
copyFileSync(pngBySize.get(1024), join(REPO, "apps/desktop/resources/icon.png"));
writeIco(join(REPO, "apps/desktop/resources/icon.ico"), [16, 32, 48, 256]);
writeIcns(join(REPO, "apps/desktop/resources/icon.icns"));

rmSync(work, { recursive: true, force: true });
console.log("Regenerated VAIA brand icons.");
