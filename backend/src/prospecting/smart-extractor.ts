import { llm } from '../ai/router.js';
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

export interface ExtractedContact {
  first_name?: string;
  last_name?: string;
  phone_landline?: string;
  phone_mobile?: string;
  email_personal?: string;
  email_institutional?: string;
  company?: string;
  location?: string;
  industry?: string;
}

/**
 * Converts any uploaded file buffer to plain text for AI processing.
 */
export async function fileToText(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop() ?? '';

  // PDF — import pdf-parse through CJS to bypass its ESM test-runner issue
  if (mimetype.includes('pdf') || ext === 'pdf') {
    try {
      const pdfParse = _require('pdf-parse/lib/pdf-parse.js') as (
        buf: Buffer
      ) => Promise<{ text: string }>;
      const data = await pdfParse(buffer);
      return data.text ?? '';
    } catch {
      // Fallback: rough text extraction for simple PDFs
      return buffer.toString('latin1').replace(/[^\x20-\x7E\n\t]/g, ' ').replace(/\s{3,}/g, '\n');
    }
  }

  // Excel — convert every sheet to CSV text
  if (
    ext === 'xlsx' || ext === 'xls' ||
    mimetype.includes('spreadsheet') || mimetype.includes('excel')
  ) {
    const wb = xlsxRead(buffer, { type: 'buffer' });
    return wb.SheetNames
      .map((name) => xlsxUtils.sheet_to_csv(wb.Sheets[name]))
      .join('\n\n');
  }

  // CSV / plain text
  return buffer.toString('utf-8');
}

/**
 * Calls Mistral to extract structured contacts from a raw text chunk.
 */
async function extractBatch(text: string, sourceHint: string): Promise<ExtractedContact[]> {
  const system = `Eres un extractor experto de datos de contacto. Analiza cualquier texto (tablas, listas, CSV, fichas) y extrae TODOS los contactos que encuentres, sin importar el formato o idioma.

Devuelve SOLO un JSON array. Sin texto adicional ni explicaciones.

Campos a extraer (omite los que no existan en el texto):
- first_name: Nombre(s) de pila
- last_name: Apellido(s)
- phone_landline: Teléfono fijo/convencional (en Ecuador empieza con 02-07; en otros países tiene código de área fija)
- phone_mobile: Celular/móvil (en Ecuador empieza con 09; en otros países 10 dígitos típicamente)
- email_personal: Email en dominio personal → gmail.com, hotmail.com, yahoo.com, outlook.com, live.com, icloud.com, me.com
- email_institutional: Email corporativo/institucional → CUALQUIER otro dominio
- company: Empresa u organización
- location: Ciudad, provincia o país
- industry: Sector o industria

Regla crítica para emails:
- @gmail / @hotmail / @yahoo / @outlook.com / @live / @icloud / @me → email_personal
- Cualquier otro dominio (empresa, universidad, gobierno) → email_institutional
- Si hay UN solo email: clasifícalo correctamente por dominio
- Si hay DOS emails: uno va en personal y otro en institutional

Ejemplo de salida válida:
[{"first_name":"Ana","last_name":"Torres Vega","phone_mobile":"0991234567","phone_landline":"022345678","email_personal":"ana@gmail.com","email_institutional":"atorres@empresa.com","company":"Empresa S.A.","location":"Quito","industry":"Servicios"}]`;

  const user = `Fuente de datos: ${sourceHint}\n\n${text}`;

  try {
    const raw = await llm('classify', system, user, 3000);
    const start = raw.indexOf('[');
    const end   = raw.lastIndexOf(']') + 1;
    if (start === -1 || end === 0) return [];
    const arr = JSON.parse(raw.slice(start, end)) as ExtractedContact[];
    return Array.isArray(arr)
      ? arr.filter((c) =>
          c.first_name || c.last_name || c.email_personal ||
          c.email_institutional || c.phone_mobile || c.phone_landline
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * Splits large texts into chunks and runs AI extraction on each.
 * Processes sequentially to avoid rate limits.
 */
export async function extractContactsFromText(
  rawText: string,
  sourceHint = 'archivo importado'
): Promise<ExtractedContact[]> {
  const MAX = 6000;
  const text = rawText.trim();
  if (!text) return [];

  if (text.length <= MAX) return extractBatch(text, sourceHint);

  // Split by lines to avoid cutting a contact in half
  const lines  = text.split('\n');
  const chunks: string[] = [];
  let cur = '';

  for (const line of lines) {
    if (cur.length + line.length > MAX && cur) {
      chunks.push(cur.trim());
      cur = '';
    }
    cur += line + '\n';
  }
  if (cur.trim()) chunks.push(cur.trim());

  const results: ExtractedContact[] = [];
  for (const chunk of chunks) {
    const batch = await extractBatch(chunk, sourceHint);
    results.push(...batch);
  }
  return results;
}
