import { NextRequest, NextResponse } from 'next/server'
import { orchestrate } from '../../../agents/orchestrator'

export const runtime = 'nodejs'
export const maxDuration = 60

const ALLOWED_EXTENSIONS = ['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'pdf']
const MAX_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 },
    )
  }

  const result = await orchestrate(file)
  return NextResponse.json(result)
}
