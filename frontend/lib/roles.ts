export function normalizeRoles(roles: string[]): string[] {
  return roles.map((role) => {
    if (role === 'Admin Codex') return 'ADMIN'
    if (role === 'Chauffeur Codex') return 'CHAUFFEUR'
    if (role === 'Supervision Globale' || role === 'Delivops Team') {
      return 'GLOBAL_SUPERVISION'
    }
    return role
  })
}

