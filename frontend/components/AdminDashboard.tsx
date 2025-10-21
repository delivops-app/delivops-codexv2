'use client'

import Link from 'next/link'

import ClientManager from './ClientManager'

type AdminDashboardProps = {
  onInvite: () => void
}

export default function AdminDashboard({ onInvite }: AdminDashboardProps) {
  return (
    <section className="mt-6 flex w-full max-w-4xl flex-col items-center gap-6">
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={onInvite}
          className="rounded bg-green-600 px-4 py-2 text-white"
        >
          Inviter un chauffeur
        </button>
        <Link
          href="/chauffeurs"
          className="mt-2 rounded bg-blue-600 px-4 py-2 text-white"
        >
          Voir les chauffeurs
        </Link>
        <Link
          href="/chauffeurs/synthese"
          className="mt-2 rounded bg-purple-600 px-4 py-2 text-white"
        >
          Synthèse des chauffeurs
        </Link>
        <Link
          href="/aide/admin"
          className="mt-2 rounded bg-amber-500 px-4 py-2 text-white"
        >
          Guide administrateur
        </Link>
      </div>
      <ClientManager />
    </section>
  )
}
