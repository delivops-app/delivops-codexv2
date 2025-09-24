const DEFAULT_SCOPE = 'openid profile email offline_access'

function readEnv(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function resolveAuth0Audience(): string | undefined {
  return readEnv(process.env.AUTH0_AUDIENCE) ?? readEnv(process.env.NEXT_PUBLIC_AUTH0_AUDIENCE)
}

export function resolveAuth0Scope(): string {
  return readEnv(process.env.AUTH0_SCOPE) ?? readEnv(process.env.NEXT_PUBLIC_AUTH0_SCOPE) ?? DEFAULT_SCOPE
}

export function buildAuth0AuthorizationParams(): Record<string, string> | undefined {
  const params: Record<string, string> = {}

  const scope = resolveAuth0Scope()
  if (scope) {
    params.scope = scope
  }

  const audience = resolveAuth0Audience()
  if (audience) {
    params.audience = audience
  }

  return Object.keys(params).length > 0 ? params : undefined
}
