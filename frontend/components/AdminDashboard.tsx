'use client'

import Link from 'next/link'

type AdminDashboardProps = {
  onInvite: () => void
  roles: string[]
}

export default function AdminDashboard({ onInvite, roles }: AdminDashboardProps) {
  const hasSupervisionAccess = roles.includes('GLOBAL_SUPERVISION')
  const hasDriverActivityAccess =
    hasSupervisionAccess || roles.includes('ADMIN')

  return (
    <section className="mt-6 flex w-full max-w-4xl flex-col items-center gap-6">
      <div className="grid w-full gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onInvite}
          className="rounded bg-green-600 px-4 py-2 text-white"
        >
          Ajouter un chauffeur
        </button>
        <Link
          href="/chauffeurs"
          className="rounded bg-blue-600 px-4 py-2 text-center text-white"
        >
          Liste des chauffeurs
        </Link>
        <Link
          href="/chauffeurs/synthese"
          className="rounded bg-purple-600 px-4 py-2 text-center text-white"
        >
          Synthèse des chauffeurs
        </Link>
        <Link
          href="/clients"
          className="rounded bg-emerald-600 px-4 py-2 text-center text-white"
        >
          Paramétrage &amp; récapitulatif clients
        </Link>
        {hasSupervisionAccess && (
          <Link
            href="/admin"
            className="rounded bg-slate-700 px-4 py-2 text-center text-white"
          >
            Espace Delivops
          </Link>
        )}
        {hasDriverActivityAccess && (
          <Link
            href="/admin/chauffeurs-activite"
            className="rounded bg-blue-700 px-4 py-2 text-center text-white"
          >
            Activité des chauffeurs
          </Link>
        )}
        {hasSupervisionAccess && (
          <Link
            href="/monitoring"
            className="rounded bg-indigo-600 px-4 py-2 text-center text-white"
          >
            Supervision globale
          </Link>
        )}
        {hasSupervisionAccess && (
          <Link
            href="/admin/tenants-users"
            className="rounded bg-teal-600 px-4 py-2 text-center text-white"
          >
            Correspondance utilisateurs/tenants
          </Link>
        )}
        <Link
          href="/aide/admin"
          className="rounded bg-amber-500 px-4 py-2 text-center text-white"
        >
          Guide administrateur
        </Link>
      </div>
    </section>
  )
}
