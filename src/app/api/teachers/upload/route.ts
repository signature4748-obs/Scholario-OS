import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

/**
 * POST /api/teachers/upload — teacher photo / signature upload
 * (Wave 2.3 §5), sharing the admission upload architecture:
 *
 *   - allowed types: JPG / PNG / WebP (verified by MAGIC BYTES, not the
 *     declared MIME type — a renamed file cannot pass)
 *   - max size: PHOTO 2 MB · SIGNATURE 1 MB (kind=form field)
 *   - dimension validation: the decoded image must be a real image
 *     (photo ≥ 200 × 200 px; signature ≥ 60 × 60 px; both ≤ 6000 px)
 *
 * Files are stored under db/uploads/teachers/ with an opaque id; the
 * original filename is kept only as display metadata.
 */

type SniffedType = 'jpeg' | 'png' | 'webp'

interface ImageDimensions {
  width: number
  height: number
}

const PHOTO_MAX_BYTES = 2 * 1024 * 1024
const SIGNATURE_MAX_BYTES = 1 * 1024 * 1024
const UPLOAD_DIR = path.join(process.cwd(), 'db', 'uploads', 'teachers')

/** Detect the real content type from the leading bytes (magic numbers). */
function sniffType(buf: Buffer): SniffedType | null {
  // JPEG SOI
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpeg'
  }
  // PNG signature
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'png'
  }
  // RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

/** Read intrinsic pixel dimensions from the image header bytes. */
function readDimensions(buf: Buffer, type: SniffedType): ImageDimensions | null {
  try {
    if (type === 'png') {
      // PNG IHDR: width at offset 16, height at 20 (big-endian u32).
      if (buf.length < 24) return null
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    }
    if (type === 'jpeg') {
      // Walk JPEG segments to find a SOFn frame header.
      let off = 2
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) { off++; continue }
        const marker = buf[off + 1]
        // SOF0..SOF15 (skipping C4/C8/CC which are not frame headers).
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          const height = buf.readUInt16BE(off + 5)
          const width = buf.readUInt16BE(off + 7)
          return { width, height }
        }
        const segLen = buf.readUInt16BE(off + 2)
        if (segLen < 2) return null
        off += 2 + segLen
      }
      return null
    }
    if (type === 'webp') {
      const chunk = buf.toString('ascii', 12, 16)
      if (chunk === 'VP8 ') {
        // Lossy: 3-byte frame tag, then sync code, then 14-bit dims.
        if (buf.length < 30) return null
        const width = buf.readUInt16LE(26) & 0x3fff
        const height = buf.readUInt16LE(28) & 0x3fff
        return { width, height }
      }
      if (chunk === 'VP8L') {
        // Lossless: 1-byte signature, then 14-bit dims packed in 4 bytes.
        if (buf.length < 25) return null
        const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24]
        const width = 1 + (((b1 & 0x3f) << 8) | b0)
        const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
        return { width, height }
      }
      if (chunk === 'VP8X') {
        // Extended: canvas size - 1 in 24 bits, little-endian, at offset 24.
        if (buf.length < 30) return null
        const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16))
        const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16))
        return { width, height }
      }
      return null
    }
    return null
  } catch {
    return null
  }
}

const EXT: Record<SniffedType, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' }
const MIME: Record<SniffedType, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    const kind = form.get('kind') === 'signature' ? 'signature' : 'photo'

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'No file received.' },
        { status: 400 }
      )
    }

    const maxBytes = kind === 'photo' ? PHOTO_MAX_BYTES : SIGNATURE_MAX_BYTES
    const maxLabel = kind === 'photo' ? '2 MB' : '1 MB'

    // Size guard — reject oversized uploads regardless of what the client says.
    if (file.size > maxBytes) {
      return NextResponse.json(
        { success: false, error: `File is too large. Maximum size is ${maxLabel}.` },
        { status: 413 }
      )
    }

    const bytes = Buffer.from(await file.arrayBuffer())

    // Content guard — the actual bytes must decode as JPG/PNG/WebP.
    const sniffed = sniffType(bytes)
    if (!sniffed) {
      return NextResponse.json(
        { success: false, error: 'Unsupported file type. Allowed: JPG, PNG, WebP.' },
        { status: 415 }
      )
    }

    // Dimension guard — a photo must be a usable portrait image; a
    // signature must be a legible strip. Applies to the actual decoded
    // header, not any client claim.
    const dims = readDimensions(bytes, sniffed)
    if (!dims) {
      return NextResponse.json(
        { success: false, error: 'Could not read image dimensions — the file may be corrupt.' },
        { status: 415 }
      )
    }
    const MIN = kind === 'photo' ? 200 : 60
    const MAX = 6000
    if (dims.width < MIN || dims.height < MIN) {
      return NextResponse.json(
        {
          success: false,
          error: `Image is too small (${dims.width} × ${dims.height} px). Minimum is ${MIN} × ${MIN} px.`,
        },
        { status: 415 }
      )
    }
    if (dims.width > MAX || dims.height > MAX) {
      return NextResponse.json(
        {
          success: false,
          error: `Image is too large (${dims.width} × ${dims.height} px). Maximum is ${MAX} × ${MAX} px.`,
        },
        { status: 415 }
      )
    }

    await mkdir(UPLOAD_DIR, { recursive: true })
    const fileId = `${kind}-${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${EXT[sniffed]}`
    await writeFile(path.join(UPLOAD_DIR, fileId), bytes)

    return NextResponse.json({
      success: true,
      fileId,
      fileName: file.name,
      size: file.size,
      mime: MIME[sniffed],
      width: dims.width,
      height: dims.height,
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Upload failed. Please try again.' },
      { status: 500 }
    )
  }
}
