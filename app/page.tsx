import { UploadZone } from '../components/UploadZone'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recon AI</h1>
          <p className="text-gray-500 mt-1">
            Drop any platform statement. We parse it in seconds.
          </p>
        </div>
        <UploadZone />
        <p className="text-xs text-gray-400 text-center">
          Quilter · Transact · Fidelity · AJ Bell · Aegon · and any other platform
        </p>
      </div>
    </main>
  )
}
