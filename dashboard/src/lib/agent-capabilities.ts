// Capacidades disponibles para un Agente IA (ai_agents.capabilities, jsonb
// array de strings). Espejo intencional de backend/src/ai/agents.ts (mismo
// array de keys + acá se agregan las etiquetas/descripciones en español para
// los checkboxes del wizard). No hay JSON Schema compartido entre backend y
// dashboard en este repo (mismo patrón que ALL_SUBMODULE_KEYS vs el CHECK de
// SQL en modules.ts), así que si se agrega/renombra una capacidad en el
// backend, hay que replicarlo acá.

export type AgentCapabilityKey =
  | 'chat_whatsapp'
  | 'use_catalog'
  | 'psych_profiling'
  | 'escalate_on_frustration'
  | 'voice_calls';

export type AgentCapabilityDef = {
  key: AgentCapabilityKey;
  label: string;
  description: string;
};

export const AGENT_CAPABILITIES: AgentCapabilityDef[] = [
  {
    key: 'chat_whatsapp',
    label: 'Responder conversaciones de WhatsApp automáticamente',
    description:
      'Si se apaga, el mensaje entrante se guarda igual pero la IA no responde: la conversación queda esperando a un humano.',
  },
  {
    key: 'use_catalog',
    label: 'Consultar el catálogo de productos al responder',
    description:
      'Si se apaga, la IA no menciona precios ni productos del catálogo aunque existan (útil para un agente de puro soporte).',
  },
  {
    key: 'psych_profiling',
    label: 'Adaptar el tono según psicología del cliente (DISC, objeciones, urgencia)',
    description:
      'Analiza cada conversación con IA para ajustar el estilo de venta. Apagarlo también ahorra una llamada extra a la IA.',
  },
  {
    key: 'escalate_on_frustration',
    label: 'Escalar a un humano si detecta frustración o lo piden explícitamente',
    description:
      'Marca al cliente como "necesita humano" en el CRM y responde con un mensaje de traspaso amable en vez de seguir insistiendo.',
  },
  {
    key: 'voice_calls',
    label: 'Usar esta personalidad también en llamadas telefónicas (Twilio)',
    description:
      'Aplica estas mismas instrucciones en llamadas de voz. El formato de la llamada (1-3 frases, sin markdown) no es editable.',
  },
];

export const AGENT_CAPABILITY_KEYS: AgentCapabilityKey[] = AGENT_CAPABILITIES.map((c) => c.key);
