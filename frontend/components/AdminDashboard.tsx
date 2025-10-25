'use client'

import Link from 'next/link'

type AdminDashboardProps = {
  onInvite: () => void
  roles: string[]
}

type DashboardItem =
  | {
      key: string
      type: 'link'
      href: string
      title: string
      description: string
      visible: boolean
    }
  | {
      key: string
      type: 'button'
      onClick: () => void
      title: string
      description: string
      visible: boolean
    }

const baseCardClass =
  'group flex h-full flex-col justify-between rounded-md border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500'

export default function AdminDashboard({ onInvite, roles }: AdminDashboardProps) {
  const hasSupervisionAccess = roles.includes('GLOBAL_SUPERVISION')
  const hasDriverActivityAccess =
    hasSupervisionAccess || roles.includes('ADMIN')

  const items: DashboardItem[] = [
    {
      key: 'invite-driver',
      type: 'button',
      onClick: onInvite,
      title: 'Ajouter un chauffeur',
      description:
        'Invitez un nouveau collaborateur et envoyez-lui immédiatement un lien d\'accès.',
      visible: true,
    },
    {
      key: 'drivers-list',
      type: 'link',
      href: '/chauffeurs',
      title: 'Liste des chauffeurs',
      description:
        'Consultez le statut de vos chauffeurs et leur dernière activité connue.',
      visible: true,
    },
    {
      key: 'drivers-summary',
      type: 'link',
      href: '/chauffeurs/synthese',
      title: 'Synthèse des chauffeurs',
      description:
        'Analysez les déclarations des tournées et exportez vos données de facturation.',
      visible: true,
    },
    {
      key: 'clients-settings',
      type: 'link',
      href: '/clients',
      title: 'Paramétrage clients',
      description:
        'Administrez vos donneurs d\'ordre et leurs catégories tarifaires.',
      visible: true,
    },
    {
      key: 'drivers-activity',
      type: 'link',
      href: '/admin/chauffeurs-activite',
      title: 'Activité des chauffeurs',
      description:
        'Suivez en direct les tournées en cours et les clôtures réalisées.',
      visible: hasDriverActivityAccess,
    },
    {
      key: 'admin-space',
      type: 'link',
      href: '/admin',
      title: 'Espace Delivops',
      description:
        'Retrouvez l\'ensemble des outils de supervision et de pilotage.',
      visible: hasSupervisionAccess,
    },
    {
      key: 'global-monitoring',
      type: 'link',
      href: '/monitoring',
      title: 'Supervision globale',
      description:
        'Contrôlez les flux d\'activité agrégés des administrateurs et des chauffeurs.',
      visible: hasSupervisionAccess,
    },
    {
      key: 'tenants-users',
      type: 'link',
      href: '/admin/tenants-users',
      title: 'Correspondance utilisateurs/tenants',
      description:
        'Assurez le suivi des accès multi-tenants des administrateurs.',
      visible: hasSupervisionAccess,
    },
    {
      key: 'admin-guide',
      type: 'link',
      href: '/aide/admin',
      title: 'Guide administrateur',
      description:
        'Retrouvez les bonnes pratiques et réponses aux questions fréquentes.',
      visible: true,
    },
  ]

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Espace administrateur</h2>
          <p className="text-sm text-slate-600">
            Centralisez toutes vos actions de gestion depuis un hub unique.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items
          .filter((item) => item.visible)
          .map((item) => {
            if (item.type === 'link') {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  target="_self"
                  className={baseCardClass}
                >
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-700">{item.description}</p>
                  </div>
                  <span className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 transition group-hover:text-indigo-700">
                    Ouvrir
                    <span className="ml-1 text-base" aria-hidden>
                      →
                    </span>
                  </span>
                </Link>
              )
            }

            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className={baseCardClass}
              >
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">{item.description}</p>
                </div>
                <span className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 transition group-hover:text-indigo-700">
                  Inviter
                  <span className="ml-1 text-base" aria-hidden>
                    →
                  </span>
                </span>
              </button>
            )
          })}
      </div>
    </section>
  )
}
