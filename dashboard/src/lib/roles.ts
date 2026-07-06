// Prioridad determinística para elegir el rol activo por defecto.
const ROLE_PRIORITY = ['admin', 'socia', 'agent'] as const;

/** Elige el rol activo por defecto al iniciar sesión (o si el rol de la cookie ya no es válido). */
export function defaultActiveRole(roleKeys: string[]): string | null {
  if (roleKeys.length === 0) return null;
  for (const key of ROLE_PRIORITY) if (roleKeys.includes(key)) return key;
  return roleKeys[0]; // rol futuro no listado en ROLE_PRIORITY
}
