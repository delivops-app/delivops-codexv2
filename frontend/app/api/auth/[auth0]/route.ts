import { handleAuth, handleLogin } from '@auth0/nextjs-auth0'

import { buildAuth0AuthorizationParams } from '../../../../lib/auth0Params'

const authHandler = handleAuth({
  async login(req, ctx) {
    const url = req.nextUrl

    const baseAuthorizationParams = buildAuth0AuthorizationParams() ?? {}

    const forwardedAuthorizationParams: Record<string, string> = {}
    const FORWARDED_QUERY_PARAMS = ['prompt', 'login_hint'] as const
    for (const param of FORWARDED_QUERY_PARAMS) {
      const value = url.searchParams.get(param)
      if (value) {
        forwardedAuthorizationParams[param] = value
      }
    }

    const authorizationParams = {
      ...baseAuthorizationParams,
      ...forwardedAuthorizationParams,
    }

    const returnTo = url.searchParams.get('returnTo') ?? undefined

    const loginOptions: { authorizationParams?: Record<string, string>; returnTo?: string } = {}
    if (Object.keys(authorizationParams).length > 0) {
      loginOptions.authorizationParams = authorizationParams
    }
    if (returnTo) {
      loginOptions.returnTo = returnTo
    }

    return handleLogin(req, ctx, loginOptions)
  },
})

export const GET = authHandler
export const POST = authHandler
