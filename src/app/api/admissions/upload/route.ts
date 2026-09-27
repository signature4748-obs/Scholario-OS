import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

/**
 * POST /api/admissions/upload — supporting-document upload for admission
 * applications.
 *
 * SERVER-SIDE enforcement of the admission upload policy (spec §10):
 *   - allowed types: PDF / JPG / PNG  (verified by magic bytes, not just the
 *     declared MIME type — a client cannot bypass with a renamed file)
 *   - max size: 5 MB per file
 *
 * Files are stored under db/uploads/admissions/ with an opaque id; the
 * original filename is kept only as display metadata in the response.
 */

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const UPLOAD_DIR = path.join(process.cwd(), 'db', 'uploads', 'admissions')

type SniffedType = 'pdf' | 'jpeg' | 'png'

/** Detect the real content type from the leading bytes (magic numbers). */
function sniffType(buf: Buffer): SniffedType | null {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return 'pdf' // %PDF
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpeg' // JPEG SOI
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'png' // PNG signature
  }
  return null
}

const EXT: Record<SniffedType, string> = { pdf: 'pdf', jpeg: 'jpg', png: 'png' }
const MIME: Record<SniffedType, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'No file received.' },
        { status: 400 }
      )
    }

    // Size guard — reject oversized uploads regardless of what the client says.
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File is too large. Maximum size is 5 MB.' },
        { status: 413 }
      )
    }

    const bytes = Buffer.from(await file.arrayBuffer())

    // Content guard — the actual bytes must decode as PDF/JPG/PNG.
    const sniffed = sniffType(bytes)
    if (!sniffed) {
      return NextResponse.json(
        { success: false, error: 'Unsupported file type. Allowed: PDF, JPG, PNG.' },
        { status: 415 }
      )
    }

    await mkdir(UPLOAD_DIR, { recursive: true })
    const fileId = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${EXT[sniffed]}`
    await writeFile(path.join(UPLOAD_DIR, fileId), bytes)

    return NextResponse.json({
      success: true,
      fileId,
      fileName: file.name,
      size: file.size,
      mime: MIME[sniffed],
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Upload failed. Please try again.' },
      { status: 500 }
    )
  }
}
