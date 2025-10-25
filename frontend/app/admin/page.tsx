'use client'

import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

import { PageLayout } from '../../components/PageLayout'
import { normalizeRoles } from '../../lib/roles'

export default function AdminHomePage() {
  const { user, error, isLoading } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || []),
  )
  const hasSupervisionAccess = roles.includes('GLOBAL_SUPERVISION')

  if (isLoading) {
    return (
      <PageLayout title="Chargement en cours">
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Préparation de votre espace administrateur…</p>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout
        title="Une erreur est survenue"
        description="Impossible de charger votre espace administrateur."
        actions={
          <Link
            href="/"
            target="_self"
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Retour à l&apos;accueil
          </Link>
        }
      >
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error.message}
        </div>
      </PageLayout>
    )
  }

  if (!hasSupervisionAccess) {
    return (
      <PageLayout
        title="Accès restreint"
        description="Cette section est réservée à l&apos;équipe Delivops en charge de la supervision globale."
        actions={
          <Link
            href="/"
            target="_self"
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Retour à l&apos;accueil
          </Link>
        }
      >
        <p className="text-sm text-slate-600">
          Veuillez contacter un administrateur Delivops si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
        </p>
      </PageLayout>
    )
  }

  const navigationLinks = [
    {
      href: '/admin/chauffeurs-activite',
      label: 'Activité des chauffeurs',
      description: 'Suivez en temps réel les tournées en cours, les clôtures et les retours signalés.',
    },
    {
      href: '/chauffeurs/synthese',
      label: 'Synthèse des tournées',
      description: 'Consultez et exportez les déclarations réalisées par vos chauffeurs.',
    },
    {
      href: '/chauffeurs/invite',
      label: 'Ajouter un chauffeur',
      description: 'Invitez un nouveau collaborateur et gérez vos quotas d&apos;accès.',
    },
    {
      href: '/chauffeurs',
      label: 'Liste des chauffeurs',
      description: 'Visualisez le statut de vos chauffeurs et leur dernière activité.',
    },
    {
      href: '/clients',
      label: 'Liste des clients',
      description: 'Administrez les donneurs d&apos;ordre et leur historique de déclarations.',
    },
    {
      href: '/monitoring',
      label: 'Supervision globale',
      description: 'Contrôlez les flux d&apos;activité agrégés côté administrateurs et chauffeurs.',
    },
    {
      href: '/settings/billing',
      label: 'Paramétrage de la facturation',
      description: 'Accédez aux informations de facturation et à la gestion des licences.',
    },
    {
      href: '/aide/admin',
      label: 'FAQ administrateurs',
      description: 'Retrouvez les réponses aux questions fréquentes de l&apos;équipe support.',
    },
    {
      href: '/admin/tenants-users',
      label: 'Correspondance utilisateurs / tenants',
      description: 'Assurez le suivi des accès multi-tenants des administrateurs.',
    },
  ] as const

  return (
    <PageLayout
      title="Espace Delivops"
      description="Centralisez toutes vos actions administrateur depuis une interface unifiée."
      actions={
        <Link
          href="/"
          target="_self"
          className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Retour à l&apos;accueil
        </Link>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {navigationLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            target="_self"
            className="group block h-full rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            <h2 className="text-lg font-semibold text-slate-900">{link.label}</h2>
            <p className="mt-2 text-sm text-slate-600">{link.description}</p>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 transition group-hover:text-indigo-700">
              Consulter
              <span className="ml-1 text-base" aria-hidden>
                →
              </span>
            </span>
          </Link>
        ))}
      </section>
    </PageLayout>
  )
}
