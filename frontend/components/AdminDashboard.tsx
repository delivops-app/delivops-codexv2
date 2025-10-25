'use client'

import type { SVGProps } from 'react'
import Link from 'next/link'

type IconComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element

type AdminDashboardProps = {
  onInvite: () => void
  roles: string[]
}

type DashboardItemBase = {
  key: string
  title: string
  description: string
  visible: boolean
  icon: IconComponent
}

type DashboardItem =
  | (DashboardItemBase & {
      type: 'link'
      href: string
    })
  | (DashboardItemBase & {
      type: 'button'
      onClick: () => void
    })

const baseCardClass =
  'group flex h-full flex-col justify-between rounded-md border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500'

const iconClass = 'h-5 w-5 flex-shrink-0 text-indigo-500'

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const UserPlusIcon: IconComponent = ({ className, ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...props} {...strokeProps}>
    <path d="M15 7a4 4 0 11-8 0 4 4 0 018 0z" />
    <path d="M4 20v-1a6 6 0 0112 0v1" />
    <path d="M19 8h3m-1.5-1.5V9.5" />
  </svg>
)

const UsersIcon: IconComponent = ({ className, ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...props} {...strokeProps}>
    <path d="M9 7a4 4 0 108 0 4 4 0 00-8 0z" />
    <path d="M5.5 7.5a3.5 3.5 0 105 3.162" />
    <path d="M3 20v-.5a6.5 6.5 0 0110.5-5.085M21 20v-.5a6.5 6.5 0 00-7.5-6.413" />
  </svg>
)

const ChartIcon: IconComponent = ({ className, ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...props} {...strokeProps}>
    <path d="M4 20h16" />
    <path d="M6.5 15.5l3-3 3 2 3.5-5" />
    <path d="M18 9l-2-2" />
  </svg>
)

const BriefcaseIcon: IconComponent = ({ className, ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...props} {...strokeProps}>
    <path d="M9 6V5a2 2 0 012-2h2a2 2 0 012 2v1" />
    <path d="M4 9a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
    <path d="M4 12h16" />
  </svg>
)

const ActivityIcon: IconComponent = ({ className, ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...props} {...strokeProps}>
    <path d="M4 12h3l2-5 4 10 2-5h5" />
  </svg>
)

const ShieldIcon: IconComponent = ({ className, ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...props} {...strokeProps}>
    <path d="M12 21c5.5-2 8-5.5 8-11V6l-8-3-8 3v4c0 5.5 2.5 9 8 11z" />
  </svg>
)

const GlobeIcon: IconComponent = ({ className, ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...props} {...strokeProps}>
    <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
    <path d="M3 12h18" />
    <path d="M12 3c2.5 3 2.5 15 0 18" />
  </svg>
)

const LayersIcon: IconComponent = ({ className, ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...props} {...strokeProps}>
    <path d="M12 4l8 4-8 4-8-4z" />
    <path d="M4 12l8 4 8-4" />
    <path d="M4 16l8 4 8-4" />
  </svg>
)

const BookIcon: IconComponent = ({ className, ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...props} {...strokeProps}>
    <path d="M5 4h7a2 2 0 012 2v14H7a2 2 0 01-2-2z" />
    <path d="M12 4h7a2 2 0 012 2v14h-7" />
  </svg>
)

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
      icon: UserPlusIcon,
    },
    {
      key: 'drivers-list',
      type: 'link',
      href: '/chauffeurs',
      title: 'Liste des chauffeurs',
      description:
        'Consultez le statut de vos chauffeurs et leur dernière activité connue.',
      visible: true,
      icon: UsersIcon,
    },
    {
      key: 'drivers-summary',
      type: 'link',
      href: '/chauffeurs/synthese',
      title: 'Synthèse des chauffeurs',
      description:
        'Analysez les déclarations des tournées et exportez vos données de facturation.',
      visible: true,
      icon: ChartIcon,
    },
    {
      key: 'clients-settings',
      type: 'link',
      href: '/clients',
      title: 'Paramétrage clients',
      description:
        'Administrez vos donneurs d\'ordre et leurs catégories tarifaires.',
      visible: true,
      icon: BriefcaseIcon,
    },
    {
      key: 'drivers-activity',
      type: 'link',
      href: '/admin/chauffeurs-activite',
      title: 'Activité des chauffeurs',
      description:
        'Suivez en direct les tournées en cours et les clôtures réalisées.',
      visible: hasDriverActivityAccess,
      icon: ActivityIcon,
    },
    {
      key: 'admin-space',
      type: 'link',
      href: '/admin',
      title: 'Espace Delivops',
      description:
        'Retrouvez l\'ensemble des outils de supervision et de pilotage.',
      visible: hasSupervisionAccess,
      icon: ShieldIcon,
    },
    {
      key: 'global-monitoring',
      type: 'link',
      href: '/monitoring',
      title: 'Supervision globale',
      description:
        'Contrôlez les flux d\'activité agrégés des administrateurs et des chauffeurs.',
      visible: hasSupervisionAccess,
      icon: GlobeIcon,
    },
    {
      key: 'tenants-users',
      type: 'link',
      href: '/admin/tenants-users',
      title: 'Correspondance utilisateurs/tenants',
      description:
        'Assurez le suivi des accès multi-tenants des administrateurs.',
      visible: hasSupervisionAccess,
      icon: LayersIcon,
    },
    {
      key: 'admin-guide',
      type: 'link',
      href: '/aide/admin',
      title: 'Guide administrateur',
      description:
        'Retrouvez les bonnes pratiques et réponses aux questions fréquentes.',
      visible: true,
      icon: BookIcon,
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
            const Icon = item.icon

            if (item.type === 'link') {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  target="_self"
                  className={baseCardClass}
                >
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      <Icon className={iconClass} aria-hidden />
                      <span>{item.title}</span>
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
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    <Icon className={iconClass} aria-hidden />
                    <span>{item.title}</span>
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
