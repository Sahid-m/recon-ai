'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const firm = localStorage.getItem('recon-firm')
    if (firm) {
      router.replace('/dashboard')
    } else {
      router.replace('/onboarding')
    }
  }, [router])

  return null
}
