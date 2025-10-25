'use client'

import type { SVGProps } from 'react'
import Link from 'next/link'

type IconComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const iconClass = 'h-5 w-5 flex-shrink-0 text-indigo-500'

const TruckIcon: IconComponent = ({ className, ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...props} {...strokeProps}>
    <path d="M3 6h11v9H3z" />
    <path d="M14 9h3l3 3v3h-6z" />
    <circle cx="7.5" cy="18" r="1.5" />
    <circle cx="17.5" cy="18" r="1.5" />
  </svg>
)

const ClipboardCheckIcon: IconComponent = ({ className, ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...props} {...strokeProps}>
    <path d="M9 4h6l1 2h2a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h2z" />
    <path d="M9 4V3h6v1" />
    <path d="M9 12l2.5 2.5L15 11" />
  </svg>
)

const LifebuoyIcon: IconComponent = ({ className, ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...props} {...strokeProps}>
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l2.1 2.1" />
    <path d="M18.4 5.6l-2.1 2.1" />
    <path d="M18.4 18.4l-2.1-2.1" />
    <path d="M5.6 18.4l2.1-2.1" />
  </svg>
)

const driverLinks = [
  {
    href: '/recuperer',
    title: 'Je récupère une tournée',
    description:
      'Sélectionnez un donneur d\'ordre et les catégories de colis à prendre en charge.',
    icon: TruckIcon,
  },
  {
    href: '/cloturer',
    title: 'Je clôture une tournée',
    description:
      'Déclarez les colis livrés et les éventuels retours pour finaliser votre tournée.',
    icon: ClipboardCheckIcon,
  },
  {
    href: '/aide/chauffeur',
    title: 'Guide chauffeur',
    description:
      'Accédez à la FAQ dédiée pour répondre à vos questions les plus fréquentes.',
    icon: LifebuoyIcon,
  },
] as const

export default function DriverActions() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Actions rapides chauffeur
          </h2>
          <p className="text-sm text-slate-600">
            Accédez instantanément aux étapes clés de vos tournées.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {driverLinks.map((link) => {
          const Icon = link.icon

          return (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-md border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition hover:border-indigo-300 hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <Icon className={iconClass} aria-hidden />
                <span>{link.title}</span>
              </h3>
              <p className="mt-2 text-sm text-slate-700">{link.description}</p>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 transition group-hover:text-indigo-700">
                Accéder
                <span className="ml-1 text-base" aria-hidden>
                  →
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
