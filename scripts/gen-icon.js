// Generates media/icon.png (128x128) with zero dependencies.
// GitRescue mark: git-orange rounded square + clean rescue shield + branch graph.
// The renderer supersamples at 4x so the Marketplace icon stays crisp.
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 128
const SCALE = 4
const bg = [240, 80, 51]
const white = [255, 255, 255]

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function pointInPoly(x, y, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1]
    const xj = pts[j][0], yj = pts[j][1]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function roundedRect(x, y, x0, y0, x1, y1, r) {
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y
  return Math.hypot(x - cx, y - cy) <= r
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : clamp01(((px - ax) * dx + (py - ay) * dy) / len2)
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function circle(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) <= r
}

function branch(x, y) {
  const stroke = 4.75
  const lines = [
    [52, 45, 52, 83],
    [52, 64, 78, 50],
  ]
  return (
    lines.some(([x0, y0, x1, y1]) => segDist(x, y, x0, y0, x1, y1) <= stroke) ||
    circle(x, y, 52, 45, 7.5) ||
    circle(x, y, 52, 83, 7.5) ||
    circle(x, y, 78, 50, 7.5)
  )
}

const shield = [
  [64, 23],
  [96, 37],
  [96, 65],
  [95.6, 69.2],
  [94.4, 73.8],
  [92.4, 78.7],
  [89.5, 83.7],
  [85.8, 88.7],
  [81.2, 93.7],
  [76.1, 98.5],
  [70.3, 103.5],
  [64, 110],
  [57.7, 103.5],
  [51.9, 98.5],
  [46.8, 93.7],
  [42.2, 88.7],
  [38.5, 83.7],
  [35.6, 78.7],
  [33.6, 73.8],
  [32.4, 69.2],
  [32, 65],
  [32, 37],
]

function sample(x, y) {
  if (!roundedRect(x, y, 0, 0, SIZE, SIZE, 28)) return [0, 0, 0, 0]
  if (pointInPoly(x, y, shield)) {
    if (branch(x, y)) return [...bg, 255]
    return [...white, 255]
  }
  return [...bg, 255]
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
let o = 0
for (let y = 0; y < SIZE; y++) {
  raw[o++] = 0
  for (let x = 0; x < SIZE; x++) {
    const rgba = [0, 0, 0, 0]
    for (let sy = 0; sy < SCALE; sy++) {
      for (let sx = 0; sx < SCALE; sx++) {
        const sampleX = x + (sx + 0.5) / SCALE
        const sampleY = y + (sy + 0.5) / SCALE
        const s = sample(sampleX, sampleY)
        rgba[0] += s[0]
        rgba[1] += s[1]
        rgba[2] += s[2]
        rgba[3] += s[3]
      }
    }
    const n = SCALE * SCALE
    raw[o++] = Math.round(rgba[0] / n)
    raw[o++] = Math.round(rgba[1] / n)
    raw[o++] = Math.round(rgba[2] / n)
    raw[o++] = Math.round(rgba[3] / n)
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0, 0)
  return Buffer.concat([len, body, crc])
}

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8
ihdr[9] = 6

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

const outDir = path.resolve(__dirname, '../media')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'icon.png')
fs.writeFileSync(outPath, png)
console.log(`Wrote ${outPath} (${png.length} bytes, ${SIZE}x${SIZE})`)
