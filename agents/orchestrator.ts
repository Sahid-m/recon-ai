import { convertFile } from '../lib/converters'
import { classify } from './classifier'
import { parse } from './parser'
import { validate } from './validator'
import type { ValidatedRow } from '../lib/schema'

export type OrchestratorResult =
  | { success: true; rows: ValidatedRow[] }
  | { success: false; error: string; rows: ValidatedRow[] }

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    return await fn()
  }
}

export async function orchestrate(file: File): Promise<OrchestratorResult> {
  let converted
  try {
    converted = await convertFile(file)
  } catch (err) {
    return { success: false, error: String(err), rows: [] }
  }

  let classifierOutput
  try {
    classifierOutput = await withRetry(() => classify(converted.sheets))
  } catch {
    return {
      success: false,
      error: 'Could not confidently parse this format. All rows need review.',
      rows: [],
    }
  }

  let parsedRows
  try {
    parsedRows = await withRetry(() => parse(converted.sheets, classifierOutput))
  } catch {
    return { success: false, error: 'No income rows found in this file.', rows: [] }
  }

  if (parsedRows.length === 0) {
    return { success: false, error: 'No income rows found in this file.', rows: [] }
  }

  let validatedRows
  try {
    validatedRows = await withRetry(() => validate(parsedRows))
  } catch {
    validatedRows = parsedRows.map(row => ({ ...row, confidence: 0, flagged: true }))
  }

  return { success: true, rows: validatedRows }
}
