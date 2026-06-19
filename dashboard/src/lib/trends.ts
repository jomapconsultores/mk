// Lee las búsquedas en tendencia (Google Trends RSS) de un país. Datos públicos y agregados.

export interface TrendItem {
  title: string;
  traffic: string;
  newsTitle: string | null;
  newsUrl: string | null;
}

function decode(s: string): string {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function pick(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? decode(m[1]) : null;
}

/**
 * Devuelve las tendencias del país (por defecto Ecuador). Cachea 1 hora.
 * Si falla, devuelve lista vacía (no rompe el panel).
 */
export async function getTrends(geo = 'EC'): Promise<TrendItem[]> {
  try {
    const res = await fetch(`https://trends.google.com/trending/rss?geo=${geo}&hl=es`, {
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; marketing-map/1.0)' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.split('<item>').slice(1).map((b) => b.split('</item>')[0]);
    const items: TrendItem[] = [];
    for (const b of blocks) {
      const title = pick(b, 'title');
      if (!title) continue;
      items.push({
        title,
        traffic: pick(b, 'ht:approx_traffic') ?? '',
        newsTitle: pick(b, 'ht:news_item_title'),
        newsUrl: pick(b, 'ht:news_item_url'),
      });
    }
    return items.slice(0, 20);
  } catch {
    return [];
  }
}
