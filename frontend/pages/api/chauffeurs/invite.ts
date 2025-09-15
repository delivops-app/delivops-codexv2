import type { NextApiRequest, NextApiResponse } from 'next'
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0'
import { apiFetch, isApiFetchError } from '../../../lib/api'

export default withApiAuthRequired(async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const response = await apiFetch('/chauffeurs/invite', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      if (isApiFetchError(response)) {
        console.error('Failed to fetch invite page from backend', response.error)
        res
          .status(502)
          .json({ detail: "Impossible de contacter le serveur d'API." })
        return
      }
      let backendMessage = ''
      try {
        backendMessage = await response.text()
      } catch (readError) {
        console.error('Failed to read backend error response', readError)
      }
      res
        .status(response.status || 502)
        .json({
          detail:
            backendMessage ||
            "Erreur lors de la récupération de la page d'invitation.",
        })
      return
    }
    const text = await response.text()
    res.status(response.status)
    res.setHeader(
      'Content-Type',
      response.headers.get('content-type') ?? 'text/html'
    )
    res.send(text)
  } catch (error) {
    res.status(502).json({ detail: 'Failed to fetch invite page' })
  }
})
