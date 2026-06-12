// One-time PWA icon generator. Renders the committed source SVG marks to PNGs
// with `sharp`. The generated PNGs are committed so production/CI builds never
// need `sharp`. Re-run after editing the source SVGs:  node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

// Anchor all paths to the repo root (this script's parent dir) so it works
// regardless of the CWD it's invoked from.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const icon = readFileSync(resolve(root, "public/icons/icon.svg"));
const maskable = readFileSync(resolve(root, "public/icons/icon-maskable.svg"));

// [source svg, output path, size]
const jobs = [
  [icon, resolve(root, "public/icons/icon-192.png"), 192],
  [icon, resolve(root, "public/icons/icon-512.png"), 512],
  [icon, resolve(root, "public/icons/apple-touch-icon.png"), 180],
  [maskable, resolve(root, "public/icons/icon-maskable-512.png"), 512],
];

for (const [svg, path, size] of jobs) {
  // density 384 renders the 512-viewBox SVG crisply before resizing.
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(path);
  const meta = await sharp(path).metadata();
  if (meta.width !== size || meta.height !== size) {
    throw new Error(`${path}: expected ${size}x${size}, got ${meta.width}x${meta.height}`);
  }
  console.log(`generated ${path} (${meta.width}x${meta.height}, ${meta.format})`);
}

console.log("icons generated");
