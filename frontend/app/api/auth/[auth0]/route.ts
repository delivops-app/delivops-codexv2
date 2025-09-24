import { handleAuth, handleLogin } from '@auth0/nextjs-auth0'

import { buildAuth0AuthorizationParams } from '../../../../lib/auth0Params'

const authHandler = handleAuth({
  async login(req, ctx) {
    const authorizationParams = buildAuth0AuthorizationParams()
    if (!authorizationParams) {
      return handleLogin(req, ctx)
    }

    return handleLogin(req, ctx, {
      authorizationParams,
    })
  },
})

export const GET = authHandler
export const POST = authHandler
