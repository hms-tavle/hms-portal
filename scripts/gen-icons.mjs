import zlib from 'zlib'
import fs from 'fs'

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function u32be(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n)
  return b
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([u32be(data.length), t, data, crc])
}

function makePng(size) {
  const raw = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3)
    raw[row] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const off = row + 1 + x * 3
      raw[off]     = 0x18 // R
      raw[off + 1] = 0x18 // G
      raw[off + 2] = 0x1b // B  → #18181b (app theme color)
    }
  }

  const ihdr = Buffer.concat([u32be(size), u32be(size), Buffer.from([8, 2, 0, 0, 0])])

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

fs.mkdirSync('public', { recursive: true })
fs.writeFileSync('public/pwa-192x192.png', makePng(192))
fs.writeFileSync('public/pwa-512x512.png', makePng(512))
console.log('Icons written: pwa-192x192.png, pwa-512x512.png')
