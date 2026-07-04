// Generates media/icon.png (128x128) with zero dependencies.
// Git-orange rounded square + white checkmark = "git, fixed".
// Deterministic: same output every run, so the committed PNG is reproducible.
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 128
const bg = [240, 80, 51] // git orange
const fg = [255, 255, 255]

// distance from point p to segment a-b
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

// checkmark vertices (normalized 0..1), scaled to SIZE
const p1 = [0.28 * SIZE, 0.52 * SIZE]
const p2 = [0.44 * SIZE, 0.68 * SIZE]
const p3 = [0.74 * SIZE, 0.34 * SIZE]
const stroke = 9 // half-width of the checkmark stroke
const radius = 26 // corner radius of the background

function roundedRectAlpha(x, y) {
  // inside a rounded square? returns coverage 0..1 with light AA
  const r = radius
  const cornerX = x < r ? r : x > SIZE - r ? SIZE - r : x
  const cornerY = y < r ? r : y > SIZE - r ? SIZE - r : y
  const d = Math.hypot(x - cornerX, y - cornerY)
  if (x >= r && x <= SIZE - r) return 1
  if (y >= r && y <= SIZE - r) return 1
  return d <= r ? 1 : Math.max(0, 1 - (d - r))
}

// build raw RGBA rows with a 1-byte filter prefix (filter 0) per row
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
let o = 0
for (let y = 0; y < SIZE; y++) {
  raw[o++] = 0 // filter: none
  for (let x = 0; x < SIZE; x++) {
    const bgA = roundedRectAlpha(x + 0.5, y + 0.5)
    // checkmark coverage
    const d = Math.min(
      segDist(x + 0.5, y + 0.5, p1[0], p1[1], p2[0], p2[1]),
      segDist(x + 0.5, y + 0.5, p2[0], p2[1], p3[0], p3[1])
    )
    const checkA = d <= stroke ? 1 : Math.max(0, 1 - (d - stroke))
    let r, g, b
    if (bgA <= 0) {
      r = g = b = 0
    } else {
      r = Math.round(bg[0] * (1 - checkA) + fg[0] * checkA)
      g = Math.round(bg[1] * (1 - checkA) + fg[1] * checkA)
      b = Math.round(bg[2] * (1 - checkA) + fg[2] * checkA)
    }
    raw[o++] = r
    raw[o++] = g
    raw[o++] = b
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

// CRC32 (PNG spec)
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
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0
const idat = zlib.deflateSync(raw, { level: 9 })

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
])

const outDir = path.resolve(__dirname, '../media')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'icon.png')
fs.writeFileSync(outPath, png)
console.log(`Wrote ${outPath} (${png.length} bytes, ${SIZE}x${SIZE})`)
