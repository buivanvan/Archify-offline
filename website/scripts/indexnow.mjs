import { pathToFileURL } from 'node:url';
import { canonicalOrigin, canonicalUrl, sitePages } from '../src/data/site-urls.mjs';
import { CASES } from '../src/data/gallery-presentation.mjs';
import { PUBLISHED_CASES } from '../src/data/published-cases.mjs';

export const key = '0e4ac4a253b420619eb3de08ba664736';
export const keyLocation = `${canonicalOrigin}/${key}.txt`;
export const sitemapLocation = `${canonicalOrigin}/sitemap.xml`;
export const endpoint = 'https://api.indexnow.org/indexnow';
const allowedUrls = new Set([
  ...sitePages.flatMap(page => ['en', 'zh'].map(lang => canonicalUrl(page, lang))),
  ...CASES.map(entry => `${canonicalOrigin}/gallery/artifacts/${entry.output.replace(/\.html$/, '')}`),
  ...PUBLISHED_CASES.map(entry => `${canonicalOrigin}/${entry.artifact.replace(/\.html$/, '')}`),
]);
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };

// Parse the deliberately small XML vocabulary emitted by publish-seo. Fail
// closed on sitemap indexes, DTDs, unexpected elements or malformed entities.
export function parseSitemap(xml) {
  requireValue(Buffer.byteLength(xml) <= 1024 * 1024, 'Sitemap exceeds 1 MiB');
  const root = xml.trim().replace(/^<\?xml\s+[^?]*\?>\s*/, '').match(/^<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"\s*>([\s\S]*)<\/urlset>$/);
  requireValue(root, 'Expected a standard sitemap urlset XML document');
  const entries = [];
  let body = root[1];
  while (body.trim()) {
    const item = body.match(/^\s*<url>\s*<loc>([^<]+)<\/loc>\s*<\/url>/);
    requireValue(item, 'Malformed sitemap URL entry');
    const value = item[1].replace(/&(?:amp|lt|gt|quot|apos);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" })[entity]);
    requireValue(!/&(?:#\w+|\w+);/.test(value), 'Unsupported XML entity');
    const url = new URL(value);
    requireValue(url.protocol === 'https:' && url.host === 'archify.si' && !url.username && !url.password && !url.search && !url.hash, `Noncanonical host or URL: ${value}`);
    requireValue(url.href === value && allowedUrls.has(value), `URL outside the published page/artifact inventory: ${value}`);
    requireValue(!entries.includes(value), `Duplicate sitemap URL: ${value}`);
    entries.push(value);
    body = body.slice(item[0].length);
  }
  requireValue(entries.length === allowedUrls.size, 'Sitemap must contain all main pages, selected gallery artifacts and published cases');
  return entries;
}

export async function notifyIndexNow() {
  throw new Error('IndexNow submission is disabled in this offline build.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.error('IndexNow submission is disabled in this offline build.');
  process.exitCode = 2;
}
