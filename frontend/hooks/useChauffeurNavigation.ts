'use client'

import { useRouter } from 'next/navigation'

export function useChauffeurNavigation() {
  const router = useRouter()

  return {
    openInviteForm: () => router.push('/api/chauffeurs/invite'),
  }
}
