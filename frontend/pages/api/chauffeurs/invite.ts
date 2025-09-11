import type { NextApiRequest, NextApiResponse } from 'next'
import { apiFetch } from '../../../lib/api'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const response = await apiFetch('/chauffeurs/invite')
  const text = await response.text()
  res.status(response.status)
  res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/html')
  res.send(text)
}
