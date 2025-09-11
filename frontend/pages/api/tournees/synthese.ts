import type { NextApiRequest, NextApiResponse } from 'next'
import { apiFetch } from '../../../lib/api'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const response = await apiFetch('/tournees/synthese')
    const text = await response.text()
    res.status(response.status)
    res.setHeader(
      'Content-Type',
      response.headers.get('content-type') ?? 'text/html'
    )
    res.send(text)
  } catch (error) {
    res.status(502).json({ detail: 'Failed to fetch summary page' })
  }
}
