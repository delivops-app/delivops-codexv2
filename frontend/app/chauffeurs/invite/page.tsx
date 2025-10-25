'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@auth0/nextjs-auth0/client'

import { PageLayout } from '../../../components/PageLayout'
import { apiFetch, isApiFetchError } from '../../../lib/api'
import { normalizeRoles } from '../../../lib/roles'

type ChauffeurQuota = {
  count: number
  subscribed: number
}

async function extractErrorDetail(response: Response) {
  try {
    const body = await response.text()
    if (!body) return null

    try {
      const data = JSON.parse(body) as { detail?: string }
      if (typeof data?.detail === 'string' && data.detail.trim().length > 0) {
        return data.detail
      }
    } catch {
      const trimmedBody = body.trim()
      if (trimmedBody.length > 0) {
        return trimmedBody
      }
    }
  } catch (error) {
    console.error('Failed to read chauffeur error response body', error)
  }

  return null
}

export default function InviteChauffeurPage() {
  const router = useRouter()
  const { user } = useUser()
  const roles = normalizeRoles(
    ((user?.['https://delivops/roles'] as string[]) || []),
  )
  const isAdmin = roles.includes('ADMIN')

  const [quota, setQuota] = useState<ChauffeurQuota | null>(null)
  const [quotaError, setQuotaError] = useState('')
  const [isQuotaLoading, setIsQuotaLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const refreshQuota = useCallback(async () => {
    if (!isAdmin) return

    setIsQuotaLoading(true)
    setQuotaError('')
    try {
      const res = await apiFetch('/chauffeurs/count')
      if (res.ok) {
        const data = (await res.json()) as ChauffeurQuota
        setQuota(data)
      } else if (isApiFetchError(res)) {
        console.error('Failed to load chauffeur quota', res.error)
        setQuota(null)
        setQuotaError('Impossible de charger le quota. Vérifiez votre connexion et réessayez.')
      } else {
        setQuota(null)
        const detail = await extractErrorDetail(res)
        setQuotaError(detail ?? 'Erreur lors du chargement du quota.')
      }
    } catch (error) {
      console.error('Unexpected error while loading chauffeur quota', error)
      setQuota(null)
      setQuotaError('Erreur lors du chargement du quota.')
    } finally {
      setIsQuotaLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void refreshQuota()
  }, [refreshQuota])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isAdmin) return

    setSubmitMessage('')
    setSubmitError('')
    setIsSubmitting(true)

    const payload = {
      email,
      display_name: displayName,
    }

    try {
      const res = await apiFetch('/chauffeurs/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setSubmitMessage('Invitation envoyée')
        setEmail('')
        setDisplayName('')
      } else if (isApiFetchError(res)) {
        console.error('Failed to invite chauffeur', res.error)
        setSubmitError('Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.')
      } else {
        const detail = await extractErrorDetail(res)
        setSubmitError(detail ?? "Erreur lors de l'invitation.")
      }
    } catch (error) {
      console.error('Unexpected error during chauffeur invitation', error)
      setSubmitError("Erreur lors de l'invitation.")
    } finally {
      setIsSubmitting(false)
    }

    await refreshQuota()
  }

  if (!isAdmin) {
    return (
      <PageLayout
        title="Accès restreint"
        description="Seuls les administrateurs Delivops peuvent inviter de nouveaux chauffeurs."
        actions={
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Retour à l&apos;accueil
          </Link>
        }
      />
    )
  }

  return (
    <PageLayout
      title="Ajouter un chauffeur"
      description="Envoyez une invitation par email et suivez votre quota en temps réel."
      actions={
        <>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            ← Retour
          </button>
          <Link
            href="/chauffeurs"
            className="inline-flex items-center justify-center rounded border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Voir la liste des chauffeurs
          </Link>
        </>
      }
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Quota disponible</h2>
              <p className="text-sm text-slate-600">
                Surveillez le nombre de chauffeurs actifs par rapport à votre abonnement.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshQuota()}
              className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isQuotaLoading}
            >
              {isQuotaLoading ? 'Actualisation…' : 'Actualiser'}
            </button>
          </header>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Chauffeurs utilisés
              </p>
              <p className="mt-2 text-3xl font-bold text-indigo-700">
                {quota ? quota.count : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Capacité disponible
              </p>
              <p className="mt-2 text-3xl font-bold text-emerald-700">
                {quota ? quota.subscribed : '—'}
              </p>
            </div>
          </div>
          {quotaError && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {quotaError}
            </p>
          )}
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Envoyer une invitation</h2>
          <p className="mt-1 text-sm text-slate-600">
            Le chauffeur recevra un email contenant un lien d&apos;activation de son compte.
          </p>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Email du chauffeur
              <input
                type="email"
                name="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Nom affiché
              <input
                type="text"
                name="display_name"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Envoi…' : 'Inviter le chauffeur'}
            </button>
          </form>
          {submitMessage && (
            <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
              {submitMessage}
            </p>
          )}
          {submitError && (
            <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {submitError}
            </p>
          )}
        </article>
      </section>
    </PageLayout>
  )
}
