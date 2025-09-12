export function normalizeRoles(roles: string[]): string[] {
  return roles.map((role) => {
    if (role === 'Admin Codex') return 'ADMIN'
    if (role === 'Chauffeur Codex') return 'CHAUFFEUR'
    return role
  })
}

