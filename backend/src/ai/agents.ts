/**
 * Capacidades disponibles para un Agente IA (ai_agents.capabilities, jsonb array
 * de strings). Solo se listan capacidades con un punto de enganche real en el
 * código — nada especulativo.
 *
 * Espejo intencional en dashboard/src/lib/agent-capabilities.ts (mismo array +
 * etiquetas en español para los checkboxes del wizard). No hay JSON Schema
 * compartido entre backend y dashboard en este repo (mismo patrón que
 * ALL_SUBMODULE_KEYS vs el CHECK de SQL), así que si se agrega/renombra una
 * capacidad aquí, hay que replicarlo allá.
 */
export const AGENT_CAPABILITIES = [
  'chat_whatsapp',
  'use_catalog',
  'psych_profiling',
  'escalate_on_frustration',
  'voice_calls',
] as const;

export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

/** Marcador que el LLM devuelve literal cuando debe escalar a un humano. */
export const ESCALATE_MARKER = '[[ESCALATE_HUMANO]]';
