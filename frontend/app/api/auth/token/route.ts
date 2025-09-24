import { getAccessToken } from '@auth0/nextjs-auth0'
import { NextResponse } from 'next/server'

import { buildAuth0AuthorizationParams } from '../../../../lib/auth0Params'

export async function GET() {
  try {
    const authorizationParams = buildAuth0AuthorizationParams()
    const tokenResponse = authorizationParams
      ? await getAccessToken({ authorizationParams })
      : await getAccessToken()

    const accessToken = tokenResponse.accessToken
    if (!accessToken) {
      return NextResponse.json({}, { status: 401 })
    }

    return NextResponse.json({ accessToken })
  } catch {
    return NextResponse.json({}, { status: 401 })
  }
}
