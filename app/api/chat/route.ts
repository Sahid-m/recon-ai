import { NextRequest, NextResponse } from 'next/server'
import { convertFile } from '../../../lib/converters'
import { rateLimit, PARSE_LIMIT } from '../../../lib/ratelimit'
import { classify } from '../../../agents/classifier'
import { parse } from '../../../agents/parser'
import { validate } from '../../../agents/validator'

export const runtime = 'nodejs'
export const maxDuration = 60

export type AgentEvent =
  | { type: 'step_start'; step: string; description: string }
  | { type: 'step_result'; step: string; data: unknown }
  | { type: 'step_error'; step: string; error: string }
  | { type: 'done'; rows: unknown[] }
  | { type: 'error'; error: string }

function encode(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

const ALLOWED_EXTENSIONS = ['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'pdf']
const MAX_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const rl = rateLimit(`parse:${ip}`, PARSE_LIMIT)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many uploads. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } }
    )
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const enc = new TextEncoder()

  const send = (event: AgentEvent) => writer.write(enc.encode(encode(event)))

  ;(async () => {
    try {
      if (!file) {
        await send({ type: 'error', error: 'No file provided.' })
        return
      }
      if (file.size > MAX_SIZE) {
        await send({ type: 'error', error: 'File too large. Max 10MB.' })
        return
      }
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        await send({ type: 'error', error: `Unsupported file type. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}` })
        return
      }

      // Step 1: Convert file
      await send({ type: 'step_start', step: 'convert', description: `Reading "${file.name}" and converting to text…` })
      let converted
      try {
        converted = await convertFile(file)
        const sheetNames = Object.keys(converted.sheets)
        await send({ type: 'step_result', step: 'convert', data: { sheets: sheetNames, rows: Object.values(converted.sheets).join('\n').split('\n').length } })
      } catch (err) {
        await send({ type: 'step_error', step: 'convert', error: String(err) })
        return
      }

      // Step 2: Classify
      await send({ type: 'step_start', step: 'classify', description: 'Identifying platform and column structure…' })
      let classifierOutput
      try {
        classifierOutput = await classify(converted.sheets)
        await send({ type: 'step_result', step: 'classify', data: classifierOutput })
      } catch (err) {
        await send({ type: 'step_error', step: 'classify', error: String(err) })
        return
      }

      // Step 3: Parse
      await send({ type: 'step_start', step: 'parse', description: `Extracting income rows from ${classifierOutput.platform} statement…` })
      let parsedRows
      try {
        parsedRows = await parse(converted.sheets, classifierOutput)
        await send({ type: 'step_result', step: 'parse', data: { count: parsedRows.length, sample: parsedRows.slice(0, 2) } })
      } catch (err) {
        await send({ type: 'step_error', step: 'parse', error: String(err) })
        return
      }

      if (parsedRows.length === 0) {
        await send({ type: 'step_error', step: 'parse', error: 'No income rows found.' })
        return
      }

      // Step 4: Validate
      await send({ type: 'step_start', step: 'validate', description: `Scoring confidence for ${parsedRows.length} rows…` })
      let validatedRows
      try {
        validatedRows = await validate(parsedRows)
        const flagged = validatedRows.filter(r => r.flagged).length
        await send({ type: 'step_result', step: 'validate', data: { total: validatedRows.length, flagged, avgConfidence: (validatedRows.reduce((s, r) => s + r.confidence, 0) / validatedRows.length).toFixed(2) } })
      } catch {
        validatedRows = parsedRows.map(row => ({ ...row, confidence: 0, flagged: true }))
        await send({ type: 'step_result', step: 'validate', data: { total: validatedRows.length, flagged: validatedRows.length, avgConfidence: '0.00' } })
      }

      await send({ type: 'done', rows: validatedRows })
    } catch (err) {
      await send({ type: 'error', error: String(err) })
    } finally {
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
