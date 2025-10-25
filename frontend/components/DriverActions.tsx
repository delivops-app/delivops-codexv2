'use client'

import Link from 'next/link'

const driverLinks = [
  {
    href: '/recuperer',
    title: 'Je récupère une tournée',
    description:
      'Sélectionnez un donneur d\'ordre et les catégories de colis à prendre en charge.',
  },
  {
    href: '/cloturer',
    title: 'Je clôture une tournée',
    description:
      'Déclarez les colis livrés et les éventuels retours pour finaliser votre tournée.',
  },
  {
    href: '/aide/chauffeur',
    title: 'Guide chauffeur',
    description:
      'Accédez à la FAQ dédiée pour répondre à vos questions les plus fréquentes.',
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
        {driverLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group rounded-md border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition hover:border-indigo-300 hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {link.title}
            </h3>
            <p className="mt-2 text-sm text-slate-700">{link.description}</p>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 transition group-hover:text-indigo-700">
              Accéder
              <span className="ml-1 text-base" aria-hidden>
                →
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
