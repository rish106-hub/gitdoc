// Generates media/icon.png (128x128) with zero dependencies.
// GitRescue mark: git-orange rounded square + rescue shield + branch nodes.
// Deterministic: same output every run, so the committed PNG is reproducible.
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 128
const bg = [240, 80, 51]
const white = [255, 255, 255]
const cutout = [240, 80, 51]
const shadow = [161, 46, 30]

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function mix(a, b, t) {
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t),
  ]
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function roundedRectAlpha(x, y, x0, y0, x1, y1, r) {
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y
  const d = Math.hypot(x - cx, y - cy)
  if (x >= x0 + r && x <= x1 - r && y >= y0 && y <= y1) return 1
  if (y >= y0 + r && y <= y1 - r && x >= x0 && x <= x1) return 1
  return clamp01(1 - (d - r))
}

function pointInPoly(x, y, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1]
    const xj = pts[j][0], yj = pts[j][1]
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

function polygonAlpha(x, y, pts) {
  const inside = pointInPoly(x, y, pts) ? 1 : 0
  let minDist = Infinity
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    minDist = Math.min(minDist, segDist(x, y, a[0], a[1], b[0], b[1]))
  }
  if (inside) return minDist < 1 ? clamp01(minDist) : 1
  return minDist < 1 ? clamp01(1 - minDist) : 0
}

function circleAlpha(x, y, cx, cy, r) {
  return clamp01(1 - (Math.hypot(x - cx, y - cy) - r))
}

function strokeAlpha(x, y, segments, halfWidth) {
  const d = Math.min(...segments.map(s => segDist(x, y, s[0], s[1], s[2], s[3])))
  return clamp01(1 - (d - halfWidth))
}

function over(dst, src, alpha) {
  const a = clamp01(alpha)
  return mix(dst, src, a)
}

const shield = [
  [64, 22],
  [94, 36],
  [89, 77],
  [64, 105],
  [39, 77],
  [34, 36],
]

const shadowShield = shield.map(([x, y]) => [x + 3, y + 4])

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
let o = 0
for (let y = 0; y < SIZE; y++) {
  raw[o++] = 0
  for (let x = 0; x < SIZE; x++) {
    const px = x + 0.5
    const py = y + 0.5
    const bgA = roundedRectAlpha(px, py, 0, 0, SIZE, SIZE, 25)
    let color = bg

    color = over(color, shadow, polygonAlpha(px, py, shadowShield) * 0.22)
    color = over(color, white, polygonAlpha(px, py, shield))

    const branchA = Math.max(
      strokeAlpha(px, py, [
        [54, 42, 54, 78],
        [54, 58, 77, 46],
      ], 4),
      circleAlpha(px, py, 54, 42, 5.6),
      circleAlpha(px, py, 54, 78, 5.6),
      circleAlpha(px, py, 77, 46, 5.6)
    )
    color = over(color, cutout, branchA)

    raw[o++] = bgA > 0 ? color[0] : 0
    raw[o++] = bgA > 0 ? color[1] : 0
    raw[o++] = bgA > 0 ? color[2] : 0
    raw[o++] = Math.round(255 * bgA)
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

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8
ihdr[9] = 6
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

const outDir = path.resolve(__dirname, '../media')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'icon.png')
fs.writeFileSync(outPath, png)
console.log(`Wrote ${outPath} (${png.length} bytes, ${SIZE}x${SIZE})`)
