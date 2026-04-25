'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentEvent } from '../api/chat/route'
import type { ChatEvent } from '../api/agent-chat/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'error'

interface Step {
  id: string
  description: string
  status: StepStatus
  result?: unknown
  error?: string
  startedAt?: number
  finishedAt?: number
}

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  fileName?: string
  rows?: unknown[]
  error?: boolean
}

interface FirmData {
  firmName: string
  clients: unknown[]
  emailAddress: string
}

// ─── Tool metadata ────────────────────────────────────────────────────────────

const TOOL_META: Record<string, { icon: string; label: string }> = {
  convert:                { icon: '📂', label: 'file_read()' },
  classify:               { icon: '🔍', label: 'classify_platform()' },
  parse:                  { icon: '⚙️', label: 'extract_rows()' },
  validate:               { icon: '✅', label: 'score_confidence()' },
  reconcile_statement:    { icon: '🔗', label: 'reconcile_statement()' },
  get_client_list:        { icon: '👥', label: 'get_client_list()' },
  get_parsed_rows:        { icon: '📊', label: 'get_parsed_rows()' },
  explain_anomaly:        { icon: '🧠', label: 'explain_anomaly()' },
  get_email_log:          { icon: '📬', label: 'get_email_log()' },
  get_firm_history:       { icon: '📋', label: 'get_firm_history()' },
  list_readmedb_files:    { icon: '🗂️', label: 'list_readmedb_files()' },
  read_readmedb_file:     { icon: '📖', label: 'read_readmedb_file()' },
  write_readmedb_file:    { icon: '💾', label: 'write_readmedb_file()' },
  save_to_readmedb:       { icon: '📝', label: 'save_to_readmedb()' },
  delete_readmedb_file:   { icon: '🗑️', label: 'delete_readmedb_file()' },
}

const QUICK_ACTIONS = [
  { label: 'Email history',    msg: 'Show me all email reconciliation runs for my firm with a summary table' },
  { label: 'Last run',         msg: 'What happened in the most recent reconciliation? Any anomalies or gaps?' },
  { label: 'Gap analysis',     msg: 'Across all reconciliation runs, which clients have the most gaps or missing income?' },
  { label: 'Client list',      msg: 'Show me my full client list with expected monthly fees' },
  { label: 'Reconcile',        msg: 'Reconcile the current statement against my client list' },
  { label: 'Explain anomalies', msg: 'Explain any anomalies in the current data' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function elapsed(step: Step): string {
  if (!step.startedAt) return ''
  const end = step.finishedAt ?? Date.now()
  return `${((end - step.startedAt) / 1000).toFixed(1)}s`
}

function StepCard({ step }: { step: Step }) {
  const [expanded, setExpanded] = useState(false)
  const meta = TOOL_META[step.id] ?? { icon: '🔧', label: step.id + '()' }

  return (
    <div className={`border rounded-lg font-mono text-xs transition-all ${
      step.status === 'running' ? 'border-amber-500/60 bg-amber-950/20' :
      step.status === 'done'    ? 'border-green-500/40 bg-green-950/10' :
      step.status === 'error'   ? 'border-red-500/40 bg-red-950/10' :
                                  'border-zinc-700 bg-zinc-900/30'
    }`}>
      <button className="w-full flex items-center gap-2 px-3 py-2 text-left" onClick={() => !!step.result && setExpanded(e => !e)}>
        <span className="shrink-0 w-3.5 flex items-center justify-center">
          {step.status === 'running' ? <span className="w-3 h-3 rounded-full border border-amber-400 border-t-transparent animate-spin inline-block" /> :
           step.status === 'done'    ? <span className="text-green-400">▸</span> :
           step.status === 'error'   ? <span className="text-red-400">✕</span> :
                                       <span className="text-zinc-600">◦</span>}
        </span>
        <span className={`font-semibold shrink-0 ${
          step.status === 'running' ? 'text-amber-300' :
          step.status === 'done'    ? 'text-green-300' :
          step.status === 'error'   ? 'text-red-300'   : 'text-zinc-500'
        }`}>{meta.icon} {meta.label}</span>
        <span className="text-zinc-500 flex-1 truncate">{step.description}</span>
        {step.startedAt && (
          <span className={`shrink-0 ${step.status === 'running' ? 'text-amber-500' : 'text-zinc-600'}`}>{elapsed(step)}</span>
        )}
        {!!step.result && <span className="text-zinc-600 ml-1">{expanded ? '▴' : '▾'}</span>}
      </button>
      {expanded && !!step.result && (
        <div className="border-t border-zinc-700 px-3 py-2 text-zinc-400 space-y-1">
          {Object.entries(step.result as Record<string, unknown>).map(([k, v]) => {
            if (v === null || v === undefined) return null
            if (Array.isArray(v)) {
              return (
                <div key={k} className="text-[11px]">
                  <span className="text-zinc-500">{k}:</span>
                  <div className="ml-2 space-y-0.5 mt-0.5">
                    {(v as unknown[]).slice(0, 8).map((item, i) => (
                      <div key={i} className="text-zinc-400 truncate">
                        {typeof item === 'object' ? Object.values(item as Record<string, unknown>).join(' · ') : String(item)}
                      </div>
                    ))}
                    {v.length > 8 && <div className="text-zinc-600">+{v.length - 8} more</div>}
                  </div>
                </div>
              )
            }
            return (
              <div key={k} className="flex gap-2 text-[11px]">
                <span className="text-zinc-500 shrink-0">{k}:</span>
                <span className="text-zinc-300 truncate">{String(v)}</span>
              </div>
            )
          })}
        </div>
      )}
      {step.error && <div className="border-t border-red-900 px-3 py-2 text-red-400 text-[11px]">{step.error}</div>}
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose-sm">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
        h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0 text-white">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-3 first:mt-0 text-zinc-100 border-b border-zinc-700 pb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0 text-zinc-200">{children}</h3>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2 text-zinc-200">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2 text-zinc-200">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children, className: cls }) => {
          const isBlock = cls?.includes('language-')
          return isBlock
            ? <code className="block bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-green-300 overflow-x-auto my-2 whitespace-pre">{children}</code>
            : <code className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs font-mono text-indigo-300">{children}</code>
        },
        pre: ({ children }) => <pre className="my-2">{children}</pre>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-zinc-900">{children}</thead>,
        th: ({ children }) => <th className="px-3 py-1.5 text-left font-semibold text-zinc-300 border border-zinc-700">{children}</th>,
        td: ({ children }) => <td className="px-3 py-1.5 text-zinc-200 border border-zinc-700">{children}</td>,
        tr: ({ children }) => <tr className="even:bg-zinc-800/40">{children}</tr>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-indigo-500 pl-3 italic text-zinc-400 my-2">{children}</blockquote>,
        hr: () => <hr className="border-zinc-700 my-3" />,
        a: ({ children, href }) => <a href={href} className="text-indigo-400 underline hover:text-indigo-300" target="_blank" rel="noopener noreferrer">{children}</a>,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 bg-indigo-600 text-white text-sm">
          {msg.fileName && (
            <div className="flex items-center gap-1.5 mb-1 text-indigo-200 text-xs font-mono">
              <span>📎</span><span>{msg.fileName}</span>
            </div>
          )}
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-1">
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mb-1">
          <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 text-[10px]">A</span>
          <span>recon.ai</span>
        </div>
        <div className={`rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed ${
          msg.error ? 'bg-red-950/40 border border-red-800/40 text-red-200' : 'bg-zinc-800 border border-zinc-700 text-zinc-100'
        }`}>
          <MarkdownContent content={msg.content} />
          {msg.rows && (
            <div className="mt-2 text-xs text-zinc-400 font-mono border-t border-zinc-700 pt-2">
              {(msg.rows as Array<{ clientName?: string; grossAmount?: number; paymentDate?: string; confidence?: number }>).slice(0, 3).map((r, i) => (
                <div key={i} className="flex gap-3 py-0.5 border-b border-zinc-700/50 last:border-0">
                  <span className="text-zinc-300">{r.clientName}</span>
                  <span className="text-green-400">£{r.grossAmount?.toFixed(2)}</span>
                  <span className="text-zinc-500">{r.paymentDate}</span>
                  <span className={r.confidence && r.confidence >= 0.8 ? 'text-green-400' : 'text-amber-400'}>
                    {r.confidence !== undefined ? `${(r.confidence * 100).toFixed(0)}%` : ''}
                  </span>
                </div>
              ))}
              {(msg.rows as unknown[]).length > 3 && <div className="text-zinc-500 pt-1">+ {(msg.rows as unknown[]).length - 3} more rows</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'agent',
    content: 'Hi! I have full access to your firm\'s reconciliation history and all past email runs. Ask me anything — "what happened last month?", "which clients have gaps?", "show me all anomalies" — or drop a statement file to reconcile it now.',
  }])
  const [steps, setSteps] = useState<Step[]>([])
  const [input, setInput] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [firm, setFirm] = useState<FirmData | null>(null)
  const [parsedRows, setParsedRows] = useState<unknown[] | null>(null)
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const stepsEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendMessageRef = useRef<((text: string) => Promise<void>) | null>(null)

  const scrollMessages = () => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  const scrollSteps = () => setTimeout(() => stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

  useEffect(() => {
    const f = localStorage.getItem('recon-firm')
    if (f) setFirm(JSON.parse(f))
    const p = sessionStorage.getItem('recon-results')
    if (p) {
      const data = JSON.parse(p)
      if (data?.rows) setParsedRows(data.rows)
    }
  }, [])

  // ── File parse pipeline (SSE from /api/chat) ──────────────────────────────

  const processFile = useCallback(async (file: File, userPrompt?: string) => {
    if (isProcessing) return
    const displayPrompt = userPrompt || `Parse and summarise ${file.name}`
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: displayPrompt, fileName: file.name }
    setMessages(prev => [...prev, userMsg])
    setSteps([])
    setIsProcessing(true)
    scrollMessages()

    // Step 1 — silently parse via /api/chat to get structured rows
    let finalRows: unknown[] = []
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/chat', { method: 'POST', body: formData })
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buffer = ''

      const upsertStep = (id: string, patch: Partial<Step>) => {
        setSteps(prev => {
          const existing = prev.find(s => s.id === id)
          if (!existing) return [...prev, { id, description: '', status: 'pending', ...patch }]
          return prev.map(s => s.id === id ? { ...s, ...patch } : s)
        })
        scrollSteps()
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += dec.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''
        for (const chunk of lines) {
          const line = chunk.replace(/^data: /, '').trim()
          if (!line) continue
          let event: AgentEvent
          try { event = JSON.parse(line) } catch { continue }
          if (event.type === 'step_start') upsertStep(event.step, { description: event.description, status: 'running', startedAt: Date.now() })
          else if (event.type === 'step_result') upsertStep(event.step, { status: 'done', result: event.data, finishedAt: Date.now() })
          else if (event.type === 'step_error') upsertStep(event.step, { status: 'error', error: event.error, finishedAt: Date.now() })
          else if (event.type === 'done') finalRows = event.rows as unknown[]
        }
      }
    } catch { /* parse failed — agent will still respond */ }

    // Step 2 — store rows and hand off to agent with the user's actual prompt
    if (finalRows.length > 0) {
      sessionStorage.setItem('recon-results', JSON.stringify({ rows: finalRows }))
      sessionStorage.setItem('recon-file', file.name)
      sessionStorage.removeItem('recon-reconcile')
      setParsedRows(finalRows)
    }

    // Step 3 — send to agent with full context
    const rows = finalRows as Array<{ flagged?: boolean; confidence?: number; clientName?: string; planNumber?: string; grossAmount?: number }>
    const flagged = rows.filter(r => r.flagged).length
    const agentContext = finalRows.length > 0
      ? `${displayPrompt}\n\n[File parsed: ${file.name} — ${finalRows.length} rows extracted, ${flagged} flagged. Row data is available in session. First few rows: ${JSON.stringify(rows.slice(0, 5))}]`
      : `${displayPrompt}\n\n[File: ${file.name} — parsing failed or returned no rows]`

    setIsProcessing(false)
    // Now send to agent — use setTimeout to ensure sendMessage is defined
    sendMessageRef.current?.(agentContext)
  }, [isProcessing])

  // ── Text chat (SSE from /api/agent-chat) ─────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    const newHistory = [...chatHistory, { role: 'user' as const, content: text }]
    setMessages(prev => [...prev, userMsg])
    setChatHistory(newHistory)
    setInput('')
    setIsProcessing(true)
    scrollMessages()

    const res = await fetch('/api/agent-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, firm, parsedRows, history: chatHistory }),
    })

    if (res.status === 429) {
      const { error } = await res.json()
      setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: `⏳ ${error}`, error: true } : m))
      setIsProcessing(false)
      return
    }

    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let buffer = ''
    let fullText = ''
    let agentMsgId = Date.now().toString() + '-agent'

    // Placeholder for streaming text
    setMessages(prev => [...prev, { id: agentMsgId, role: 'agent', content: '' }])

    const upsertStep = (id: string, patch: Partial<Step>) => {
      setSteps(prev => {
        const existing = prev.find(s => s.id === id)
        if (!existing) return [...prev, { id, description: '', status: 'pending', ...patch }]
        return prev.map(s => s.id === id ? { ...s, ...patch } : s)
      })
      scrollSteps()
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += dec.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() ?? ''
      for (const chunk of lines) {
        const line = chunk.replace(/^data: /, '').trim()
        if (!line) continue
        let event: ChatEvent
        try { event = JSON.parse(line) } catch { continue }

        if (event.type === 'tool_start') {
          upsertStep(event.tool, { description: event.description, status: 'running', startedAt: Date.now() })
        } else if (event.type === 'tool_result') {
          upsertStep(event.tool, { status: 'done', result: event.result, finishedAt: Date.now() })
        } else if (event.type === 'tool_error') {
          upsertStep(event.tool, { status: 'error', error: event.error, finishedAt: Date.now() })
        } else if (event.type === 'text_delta') {
          fullText += event.text
          setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: fullText } : m))
          scrollMessages()
        } else if (event.type === 'done') {
          fullText = event.text
          setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: fullText } : m))
          setChatHistory(prev => [...prev, { role: 'assistant', content: fullText }])
        } else if (event.type === 'error') {
          setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: event.error, error: true } : m))
        }
      }
    }

    setIsProcessing(false)
    scrollMessages()
  }, [isProcessing, firm, parsedRows, chatHistory])

  // Keep ref in sync so processFile can call it without circular dep
  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  const handleSend = () => {
    if (attachedFile) {
      const prompt = input.trim()
      processFile(attachedFile, prompt || undefined)
      setAttachedFile(null)
      setInput('')
    } else {
      sendMessage(input)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const stageFile = (file: File) => {
    setAttachedFile(file)
    // Focus textarea so user can optionally add a message
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* ── Left: Chat panel ────────────────────────────────────────────── */}
      <div
        className={`flex flex-col flex-1 min-w-0 border-r border-zinc-800 transition-colors ${dragOver ? 'bg-indigo-950/20' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) stageFile(f) }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur shrink-0">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="font-mono text-sm font-semibold text-zinc-200">recon.ai</span>
          {firm && <span className="text-zinc-600 text-xs font-mono">/ {firm.firmName}</span>}
          <div className="ml-auto flex items-center gap-3">
            {parsedRows && <span className="text-xs font-mono text-indigo-400 bg-indigo-950/40 border border-indigo-900/40 px-2 py-0.5 rounded">{parsedRows.length} rows loaded</span>}
            <Link href="/dashboard" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 border border-zinc-800 rounded">
              Dashboard →
            </Link>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
          {isProcessing && messages[messages.length - 1]?.role !== 'agent' && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 border border-zinc-700 rounded-2xl rounded-tl-sm px-4 py-2.5">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions */}
        {!isProcessing && (
          <div className="shrink-0 px-4 py-2 flex gap-2 overflow-x-auto border-t border-zinc-800/50">
            {QUICK_ACTIONS.map(a => (
              <button
                key={a.label}
                onClick={() => sendMessage(a.msg)}
                className="shrink-0 text-xs font-mono px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors whitespace-nowrap"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="shrink-0 border-t border-zinc-800 px-4 py-3 bg-zinc-950/60 space-y-2">
          {dragOver ? (
            <div className="flex items-center justify-center h-10 rounded-lg border border-dashed border-indigo-500 text-indigo-400 text-sm font-mono">
              Drop to attach
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Attached file preview */}
              {attachedFile && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-950/40 border border-indigo-800/50 rounded-lg">
                  <span className="text-sm">📎</span>
                  <span className="text-xs font-mono text-indigo-300 flex-1 truncate">{attachedFile.name}</span>
                  <span className="text-xs text-indigo-500">{(attachedFile.size / 1024).toFixed(0)} KB</span>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="text-indigo-600 hover:text-indigo-300 transition-colors ml-1 text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-40"
                  title="Attach statement"
                >
                  📎
                </button>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isProcessing}
                  placeholder={attachedFile ? 'Add a message or press ↑ to parse…' : 'Ask anything — reconcile, show clients, explain anomalies…'}
                  rows={1}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none transition-colors disabled:opacity-40"
                  style={{ minHeight: '40px', maxHeight: '120px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !attachedFile) || isProcessing}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors text-sm"
                >
                  ↑
                </button>
              </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" className="hidden" accept=".xls,.xlsx,.xlsm,.xlsb,.csv,.pdf" onChange={e => { const f = e.target.files?.[0]; if (f) stageFile(f); e.target.value = '' }} />
        </div>
      </div>

      {/* ── Right: Agent internals ───────────────────────────────────────── */}
      <div className="flex flex-col w-[400px] shrink-0 bg-zinc-950">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-800 shrink-0">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Agent internals</span>
          {isProcessing
            ? <span className="ml-auto flex items-center gap-1.5 text-amber-400 text-xs font-mono"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />running</span>
            : steps.length > 0 && <span className="ml-auto text-green-400 text-xs font-mono">complete</span>
          }
        </div>

        {/* Tools legend */}
        <div className="shrink-0 px-4 py-2.5 border-b border-zinc-800/50 flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(TOOL_META).map(([, meta]) => (
            <span key={meta.label} className="text-[10px] font-mono text-zinc-700">{meta.icon} {meta.label}</span>
          ))}
        </div>

        {/* Steps feed */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {steps.length === 0 && !isProcessing && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="text-4xl opacity-10">⚙️</div>
              <p className="text-zinc-600 text-xs font-mono max-w-[180px]">Tool calls appear here as the agent works</p>
            </div>
          )}
          {steps.map(step => <StepCard key={step.id} step={step} />)}
          <div ref={stepsEndRef} />
        </div>

        {/* Session context */}
        <div className="shrink-0 border-t border-zinc-800 px-4 py-3 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600">
            <span>firm</span>
            <span className="text-zinc-500">{firm?.firmName ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600">
            <span>clients</span>
            <span className="text-zinc-500">{firm?.clients.length ?? 0}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600">
            <span>parsed rows</span>
            <span className={parsedRows ? 'text-green-500' : 'text-zinc-600'}>{parsedRows?.length ?? 0}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600">
            <span>model</span>
            <span className="text-zinc-500">gpt-4.1</span>
          </div>
        </div>
      </div>
    </div>
  )
}
