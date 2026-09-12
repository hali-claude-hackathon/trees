#!/usr/bin/env node
/**
 * Generates the PWA icon PNGs in public/icons/ from scratch.
 *
 * Hand-rolled RGBA PNG encoder (node:zlib only) so the repo carries no image
 * tooling dependency. Re-run with `npm run icons` if the artwork changes.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICON_DIR = resolve(HERE, '..', 'public', 'icons');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** @param {number} w @param {number} h @param {Buffer} rgba raw w*h*4 bytes */
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace
  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [21, 87, 36];
const TRUNK = [124, 82, 51];
const TRUNK_DARK = [92, 60, 37];
const LEAF = [122, 201, 129];
const LEAF_DARK = [76, 163, 90];

/**
 * A "fallen tree": a trunk rotated ~35 degrees lying down, with a canopy of
 * three overlapping circles at its crown end.
 *
 * @param {number} size square edge length in px
 * @param {number} inset fraction of the edge kept clear of artwork; 0.1 for the
 *   regular icons, 0.2 for the maskable one so the art stays inside the safe zone.
 */
function drawIcon(size, inset) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const scale = (1 - 2 * inset) * size;

  // Trunk in its own rotated frame: origin at icon centre, long axis along u.
  const angle = (-35 * Math.PI) / 180;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const halfLen = scale * 0.34;
  const halfWid = scale * 0.075;

  const canopy = [
    [scale * 0.3, scale * -0.21, scale * 0.2],
    [scale * 0.44, scale * -0.02, scale * 0.15],
    [scale * 0.17, scale * -0.03, scale * 0.15],
  ];

  const set = (i, rgb, a = 255) => {
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = a;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      set(i, BG);

      // Trunk (rotate the sample point into trunk-local space).
      const u = dx * cosA + dy * sinA;
      const v = -dx * sinA + dy * cosA;
      if (Math.abs(u) <= halfLen && Math.abs(v) <= halfWid) {
        set(i, v > halfWid * 0.25 ? TRUNK_DARK : TRUNK);
      }

      // Canopy circles sit on top of the trunk's crown end.
      for (const [cx, cy, r] of canopy) {
        const ddx = dx - cx;
        const ddy = dy - cy;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d <= r) {
          set(i, d > r * 0.72 ? LEAF_DARK : LEAF);
          break;
        }
      }
    }
  }
  return encodePng(size, size, px);
}

mkdirSync(ICON_DIR, { recursive: true });
const outputs = [
  ['icon-192.png', 192, 0.1],
  ['icon-512.png', 512, 0.1],
  ['icon-maskable-512.png', 512, 0.2],
];
for (const [name, size, inset] of outputs) {
  const buf = drawIcon(size, inset);
  writeFileSync(resolve(ICON_DIR, name), buf);
  console.log(`wrote ${name}: ${size}x${size}, ${buf.length} bytes`);
}
