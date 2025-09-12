'use client'

import { useUser } from '@auth0/nextjs-auth0/client'
import Link from 'next/link'
import TourneeWizard from '../../components/TourneeWizard'
import { normalizeRoles } from '../../lib/roles'

export default function CloturerPage() {
  const { user } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || [])
  )
  if (!roles.includes('CHAUFFEUR')) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <p className="mb-4">Accès refusé</p>
        <Link href="/" className="rounded bg-gray-600 px-4 py-2 text-white">
          Retour
        </Link>
      </main>
    )
  }
  return <TourneeWizard mode="delivery" />
}

