'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()

  const handleFile = useCallback(
    async (file: File) => {
      setStatus('uploading')
      setErrorMessage('')

      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch('/api/parse-statement', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok) {
          setStatus('error')
          setErrorMessage(data.error ?? 'Something went wrong.')
          return
        }

        sessionStorage.setItem('recon-results', JSON.stringify(data))
        router.push('/results')
      } catch {
        setStatus('error')
        setErrorMessage('Upload failed. Please try again.')
      }
    },
    [router],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-white'
      }`}
    >
      {status === 'uploading' ? (
        <div className="space-y-2">
          <p className="text-gray-700 font-medium">Parsing statement...</p>
          <p className="text-sm text-gray-400">This may take 15–30 seconds</p>
        </div>
      ) : (
        <>
          <p className="text-lg font-medium text-gray-700">Drop your statement here</p>
          <p className="text-sm text-gray-400 mt-1">XLS, XLSX, CSV, PDF — any platform, any format</p>
          <label className="mt-5 inline-block cursor-pointer">
            <span className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Browse file
            </span>
            <input
              type="file"
              className="hidden"
              accept=".xls,.xlsx,.xlsm,.xlsb,.csv,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </label>
          {status === 'error' && (
            <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
          )}
        </>
      )}
    </div>
  )
}
