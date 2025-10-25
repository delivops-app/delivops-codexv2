'use client'

import { useUser } from '@auth0/nextjs-auth0/client'
import AuthButton from '../components/AuthButton'
import AdminDashboard from '../components/AdminDashboard'
import DriverActions from '../components/DriverActions'
import { PageLayout } from '../components/PageLayout'
import { useChauffeurNavigation } from '../hooks/useChauffeurNavigation'
import { normalizeRoles } from '../lib/roles'

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrateur',
  CHAUFFEUR: 'Chauffeur',
  GLOBAL_SUPERVISION: 'Supervision globale',
}

export default function Home() {
  const { user, error, isLoading } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || []),
  )
  const isAdmin = roles.includes('ADMIN')
  const isDriver = roles.includes('CHAUFFEUR')
  const { openInviteForm } = useChauffeurNavigation()

  if (isLoading) {
    return (
      <PageLayout title="Chargement en cours">
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Préparation de votre espace Delivops…
          </p>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout
        title="Une erreur est survenue"
        description="Impossible de charger votre espace Delivops."
        actions={
          <AuthButton className="w-full sm:w-auto" />
        }
      >
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error.message}
        </div>
      </PageLayout>
    )
  }

  if (!user) {
    return (
      <PageLayout
        title="Bienvenue sur Delivops"
        description="Connectez-vous pour accéder à vos outils administrateur ou chauffeur."
        actions={<AuthButton className="w-full sm:w-auto" />}
      >
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Simplifiez la gestion de vos tournées
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Delivops centralise l&apos;ensemble des actions nécessaires pour récupérer, suivre et clôturer vos tournées de livraison.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-indigo-400" aria-hidden />
              <span>Invitez vos chauffeurs et attribuez-leur des tournées en quelques secondes.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-indigo-400" aria-hidden />
              <span>Suivez les déclarations de livraison et exportez vos données de facturation.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-indigo-400" aria-hidden />
              <span>Accédez à un centre d&apos;aide dédié pour les administrateurs et les chauffeurs.</span>
            </li>
          </ul>
        </section>
      </PageLayout>
    )
  }

  const friendlyName = user.name || user.nickname || user.email || 'Utilisateur'
  const badgeRoles = roles.length
    ? roles.map((role) => (
        <span
          key={role}
          className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700"
        >
          {roleLabels[role] ?? role}
        </span>
      ))
    : [
        <span
          key="no-role"
          className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700"
        >
          Rôle en attente
        </span>,
      ]

  return (
    <PageLayout
      title={`Bonjour ${friendlyName}`}
      description="Retrouvez ici l&apos;ensemble des actions disponibles pour piloter vos tournées de livraison."
      actions={<AuthButton className="w-full sm:w-auto" />}
    >
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Vos accès sur Delivops
            </h2>
            <p className="text-sm text-slate-600">
              Vous disposez des autorisations suivantes sur cet espace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">{badgeRoles}</div>
        </div>
        {!isAdmin && !isDriver ? (
          <p className="mt-4 text-sm text-amber-700">
            Aucun module chauffeur ou administrateur n&apos;est activé pour votre compte. Contactez un responsable Delivops pour obtenir des droits supplémentaires.
          </p>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {isAdmin ? <AdminDashboard onInvite={openInviteForm} roles={roles} /> : null}

        {isDriver ? <DriverActions /> : null}
      </div>
    </PageLayout>
  )
}
