import type { NextApiRequest, NextApiResponse } from 'next'
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0'
import { apiFetch } from '../../../lib/api'

export default withApiAuthRequired(async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const response = await apiFetch('/chauffeurs/invite', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
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
