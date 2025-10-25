'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@auth0/nextjs-auth0/client'
import AuthButton from '../components/AuthButton'
import AdminDashboard from '../components/AdminDashboard'
import DriverActions from '../components/DriverActions'
import { useChauffeurNavigation } from '../hooks/useChauffeurNavigation'
import { normalizeRoles } from '../lib/roles'

export default function Home() {
  const { user, error, isLoading } = useUser()
  const router = useRouter()
  const [hasRedirected, setHasRedirected] = useState(false)
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || [])
  )
  const isAdmin = roles.includes('ADMIN')
  const isDriver = roles.includes('CHAUFFEUR')
  const { openInviteForm } = useChauffeurNavigation()

  useEffect(() => {
    if (isLoading) return
    if (error) return
    if (!isAdmin) return
    if (hasRedirected) return
    router.replace('/chauffeurs/synthese')
    setHasRedirected(true)
  }, [error, hasRedirected, isAdmin, isLoading, router])

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="mb-2 text-4xl font-bold">Delivops</h1>
      <p className="mb-6 text-center text-lg">
        Votre plateforme de gestion de livraisons
      </p>
      {isLoading && <p>Chargement...</p>}
      {error && <p>Erreur: {error.message}</p>}
      {user && <p className="mb-4">Bonjour {user.name}</p>}
      <AuthButton />
      {isAdmin && hasRedirected && (
        <p className="mt-4 text-gray-600">
          Redirection vers la synthèse des chauffeurs…
        </p>
      )}
      {isAdmin && !hasRedirected && (
        <AdminDashboard onInvite={openInviteForm} roles={roles} />
      )}
      {isDriver && <DriverActions />}
    </main>
  )
}
