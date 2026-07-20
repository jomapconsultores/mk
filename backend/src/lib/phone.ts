/**
 * Normalización de teléfonos a E.164 (solo dígitos, con código de país).
 *
 * Meta devuelve e identifica los números en E.164 sin '+', así que cualquier
 * número guardado en formato nacional (09XXXXXXXX típico de Ecuador) es
 * inservible: no se le puede enviar nada y, cuando responde, no se le encuentra
 * por igualdad exacta contra el número que manda Meta.
 */

/** Código de país por defecto cuando el número viene en formato nacional. Ecuador = 593. */
const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY_CODE ?? '593';

/**
 * Devuelve el número en E.164 sin '+' (p.ej. '593991234567'), o null si no es
 * un número plausible. Nunca inventa: si no se puede decidir, devuelve null.
 */
export function toE164(raw: string | null | undefined, countryCode = DEFAULT_COUNTRY): string | null {
  if (!raw) return null;

  const hadPlus = raw.trim().startsWith('+');
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // Ya venía en internacional: se respeta tal cual.
  if (hadPlus || digits.startsWith(countryCode)) {
    return digits.length >= 10 && digits.length <= 15 ? digits : null;
  }

  // Formato nacional: se quita el 0 inicial de troncal y se antepone el país.
  digits = digits.replace(/^0+/, '');
  if (!digits) return null;

  const full = countryCode + digits;
  return full.length >= 10 && full.length <= 15 ? full : null;
}

/** ¿Dos teléfonos son el mismo número, comparados en E.164? */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = toE164(a);
  const nb = toE164(b);
  return na !== null && na === nb;
}
