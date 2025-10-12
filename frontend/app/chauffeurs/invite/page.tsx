'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@auth0/nextjs-auth0/client'

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
    ((user?.['https://delivops/roles'] as string[]) || [])
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
        setQuotaError(
          'Impossible de charger le quota. Vérifiez votre connexion et réessayez.',
        )
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
    refreshQuota()
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
        setSubmitError(
          'Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.',
        )
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
      <main className="flex min-h-screen flex-col items-center p-8">
        <p className="mb-4">Accès refusé</p>
        <Link href="/" className="rounded bg-gray-600 px-4 py-2 text-white">
          Retour
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 rounded bg-gray-600 px-4 py-2 text-white"
        >
          Retour
        </button>
        <h1 className="mb-6 text-3xl font-bold">Inviter un chauffeur</h1>
        <div className="mb-6">
          <p>
            <span className="font-medium">Quota actuel:</span>{' '}
            {isQuotaLoading
              ? 'Chargement...'
              : quota
                ? `${quota.count}/${quota.subscribed}`
                : 'Non disponible'}
          </p>
          {quotaError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {quotaError}
            </p>
          )}
        </div>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2">
            <span className="font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium">Nom affiché</span>
            <input
              type="text"
              name="display_name"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Envoi...' : 'Inviter'}
          </button>
        </form>
        {submitMessage && (
          <p className="mt-4 text-green-600" role="status">
            {submitMessage}
          </p>
        )}
        {submitError && (
          <p className="mt-4 text-red-600" role="alert">
            {submitError}
          </p>
        )}
      </div>
    </main>
  )
}
