import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { YoutubeTranscript } from 'youtube-transcript';
import dns from 'dns/promises';
import http from 'http';
import https from 'https';
import net from 'net';

export interface ExtractedContent {
  title: string;
  text: string;
  sourceType: 'youtube' | 'url';
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(url);
}

function isTwitterUrl(url: string): boolean {
  return /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/.test(url);
}

function isRedditUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?reddit\.com\/r\//.test(url);
}

function isGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(\/|$|\?|#)/);
  if (!match) return null;
  const nonRepoPaths = ['settings', 'pulls', 'issues', 'marketplace', 'explore', 'notifications', 'new', 'organizations', 'login', 'signup'];
  if (nonRepoPaths.includes(match[2].toLowerCase())) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const MAX_URL_RESPONSE_BYTES = 5 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type PublicAddress = {
  address: string;
  family: 4 | 6;
};

function stripIpv6Zone(address: string): string {
  return address.split('%')[0].toLowerCase();
}

function ipv4FromHexHextets(high: string, low: string): string {
  const value = (parseInt(high, 16) << 16) + parseInt(low, 16);
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.');
}

function parseIpv4Parts(address: string): number[] | null {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts;
}

function parseIpv6Hextets(address: string): number[] | null {
  const convertPart = (part: string): number[] | null => {
    if (part.includes('.')) {
      const ipv4 = parseIpv4Parts(part);
      if (!ipv4) return null;
      return [(ipv4[0] << 8) + ipv4[1], (ipv4[2] << 8) + ipv4[3]];
    }
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
    return [parseInt(part, 16)];
  };

  const split = address.split('::');
  if (split.length > 2) return null;

  const left = split[0] ? split[0].split(':').flatMap(part => convertPart(part) ?? [NaN]) : [];
  const right = split.length === 2 && split[1] ? split[1].split(':').flatMap(part => convertPart(part) ?? [NaN]) : [];
  if (left.some(Number.isNaN) || right.some(Number.isNaN)) return null;

  if (split.length === 1) return left.length === 8 ? left : null;
  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;
  return [...left, ...Array(missing).fill(0), ...right];
}

function ipv4FromExpandedHextets(hextets: number[], index: number): string {
  return ipv4FromHexHextets(hextets[index].toString(16), hextets[index + 1].toString(16));
}

function isPrivateAddress(address: string): boolean {
  const normalized = stripIpv6Zone(address.replace(/^\[|\]$/g, ''));
  const ipVersion = net.isIP(normalized);

  if (ipVersion === 4) {
    const parts = normalized.split('.').map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 88) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }

  if (ipVersion === 6) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    if (normalized.startsWith('ff')) return true;
    const hextets = parseIpv6Hextets(normalized);
    if (hextets) {
      // Deprecated IPv4-compatible ::/96 forms can encode private IPv4 endpoints.
      if (hextets.slice(0, 6).every(part => part === 0)) return true;
      if (hextets.slice(0, 5).every(part => part === 0) && hextets[5] === 0xffff) {
        return isPrivateAddress(ipv4FromExpandedHextets(hextets, 6));
      }
      if (hextets.slice(0, 4).every(part => part === 0) && hextets[4] === 0xffff && hextets[5] === 0) {
        return isPrivateAddress(ipv4FromExpandedHextets(hextets, 6));
      }
      if (hextets[0] === 0x64 && hextets[1] === 0xff9b && hextets.slice(2, 6).every(part => part === 0)) {
        return isPrivateAddress(ipv4FromExpandedHextets(hextets, 6));
      }
      if (hextets[0] === 0x64 && hextets[1] === 0xff9b && hextets[2] === 1) return true;
      if (hextets[0] === 0x2001 && hextets[1] === 0) return true;
      if (hextets[0] === 0x2001 && hextets[1] === 0x0db8) return true;
    }
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) return isPrivateAddress(ipv4FromHexHextets(mappedHex[1], mappedHex[2]));
    const sixToFour = normalized.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})/);
    if (sixToFour) return isPrivateAddress(ipv4FromHexHextets(sixToFour[1], sixToFour[2]));
  }

  return false;
}

async function resolvePublicAddress(url: URL): Promise<PublicAddress> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are supported');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    isPrivateAddress(hostname)
  ) {
    throw new Error('Cannot fetch internal/private URLs');
  }

  const literalFamily = net.isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    return { address: hostname, family: literalFamily };
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('Could not resolve URL hostname');
  }

  if (addresses.length === 0 || addresses.some(a => isPrivateAddress(a.address))) {
    throw new Error('Cannot fetch internal/private URLs');
  }

  const selected = addresses[0];
  const family = net.isIP(stripIpv6Zone(selected.address));
  if (family !== 4 && family !== 6) {
    throw new Error('Could not resolve URL hostname');
  }

  return { address: selected.address, family };
}

async function readResponseText(response: Response, maxBytes = MAX_URL_RESPONSE_BYTES): Promise<string> {
  const length = response.headers.get('content-length');
  if (length && Number(length) > maxBytes) throw new Error('URL response is too large');
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('URL response is too large');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function requestHeaders(headers?: HeadersInit): http.OutgoingHttpHeaders {
  const result: http.OutgoingHttpHeaders = {};
  const normalized = new Headers(headers);
  let hasAcceptEncoding = false;

  normalized.forEach((value, key) => {
    if (key.toLowerCase() === 'accept-encoding') hasAcceptEncoding = true;
    result[key] = value;
  });

  if (!hasAcceptEncoding) result['accept-encoding'] = 'identity';
  return result;
}

function headersFromIncoming(headers: http.IncomingHttpHeaders): HeadersInit {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) result[key] = value.join(', ');
    else if (value !== undefined) result[key] = String(value);
  }
  return result;
}

function requestPinnedUrl(url: URL, address: PublicAddress, init: RequestInit, maxBytes = MAX_URL_RESPONSE_BYTES): Promise<Response> {
  const client = url.protocol === 'https:' ? https : http;
  const options: http.RequestOptions = {
    protocol: url.protocol,
    hostname: url.hostname.replace(/^\[|\]$/g, ''),
    port: url.port ? Number(url.port) : undefined,
    path: `${url.pathname}${url.search}`,
    method: init.method || 'GET',
    headers: requestHeaders(init.headers),
    lookup: (_hostname, options, callback) => {
      if (options && typeof options === 'object' && 'all' in options && options.all) {
        callback(null, [{ address: address.address, family: address.family }] as any);
        return;
      }
      callback(null, address.address, address.family);
    },
    ...(init.signal ? { signal: init.signal } : {}),
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const req = client.request(options, res => {
      const remoteAddress = res.socket.remoteAddress;
      if (remoteAddress && isPrivateAddress(remoteAddress)) {
        res.resume();
        req.destroy();
        fail(new Error('Cannot fetch internal/private URLs'));
        return;
      }

      const length = res.headers['content-length'];
      if (length && Number(length) > maxBytes) {
        res.resume();
        req.destroy();
        fail(new Error('URL response is too large'));
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;

      res.on('data', chunk => {
        if (settled) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.byteLength;
        if (total > maxBytes) {
          req.destroy();
          fail(new Error('URL response is too large'));
          return;
        }
        chunks.push(buffer);
      });

      res.on('end', () => {
        if (settled) return;
        settled = true;
        resolve(new Response(Buffer.concat(chunks), {
          status: res.statusCode || 502,
          statusText: res.statusMessage,
          headers: headersFromIncoming(res.headers),
        }));
      });

      res.on('error', fail);
    });

    req.on('error', fail);
    if (init.body) req.end(init.body as any);
    else req.end();
  });
}

async function fetchPublicUrl(url: string, init: RequestInit, maxRedirects = 5): Promise<Response> {
  let current = new URL(url);
  for (let i = 0; i <= maxRedirects; i++) {
    const address = await resolvePublicAddress(current);
    const response = await requestPinnedUrl(current, address, init);
    if (!REDIRECT_STATUSES.has(response.status)) return response;

    const location = response.headers.get('location');
    if (!location) return response;
    current = new URL(location, current);
  }
  throw new Error('Too many redirects');
}

// ─── YouTube ─────────────────────────────────

async function extractYouTube(url: string): Promise<ExtractedContent> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('Could not extract YouTube video ID from URL');

  const transcript = await YoutubeTranscript.fetchTranscript(videoId);
  if (!transcript || transcript.length === 0) {
    throw new Error('No transcript available for this YouTube video');
  }

  const text = transcript.map(t => t.text).join(' ');

  let title = `YouTube: ${videoId}`;
  try {
    const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`).then(r => readResponseText(r, 1024 * 1024));
    const $ = cheerio.load(html);
    const pageTitle = $('title').text().replace(' - YouTube', '').trim();
    if (pageTitle) title = pageTitle;
  } catch { /* use default title */ }

  return { title, text, sourceType: 'youtube' };
}

// ─── X/Twitter ───────────────────────────────

async function extractTwitter(url: string): Promise<ExtractedContent> {
  // Extract tweet ID from URL
  const match = url.match(/status\/(\d+)/);
  if (!match) throw new Error('Could not extract tweet ID from URL');
  const tweetId = match[1];

  // Try the syndication/embed API (no auth required)
  try {
      const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=0`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json() as any;
      const authorName = data.user?.name || 'Unknown';
      const authorHandle = data.user?.screen_name || '';
      const tweetText = data.text || '';
      const createdAt = data.created_at || '';

      let fullText = `Tweet by @${authorHandle} (${authorName})`;
      if (createdAt) fullText += ` on ${createdAt}`;
      fullText += `:\n\n${tweetText}`;

      // Include quoted tweet if present
      if (data.quoted_tweet?.text) {
        fullText += `\n\nQuoted tweet by @${data.quoted_tweet.user?.screen_name || 'unknown'}:\n${data.quoted_tweet.text}`;
      }

      return { title: `@${authorHandle}: ${tweetText.slice(0, 80)}...`, text: fullText, sourceType: 'url' };
    }
  } catch { /* fallback below */ }

  // Fallback: try Nitter (open-source Twitter frontend)
  try {
    const nitterInstances = ['nitter.net', 'nitter.privacydev.net'];
    const twitterPath = url.replace(/https?:\/\/(x\.com|twitter\.com)/, '');

    for (const instance of nitterInstances) {
      try {
          const res = await fetch(`https://${instance}${twitterPath}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;

        const html = await readResponseText(res, 1024 * 1024);
        const $ = cheerio.load(html);
        const tweetContent = $('.tweet-content').first().text().trim();
        const fullName = $('.fullname').first().text().trim();
        const username = $('.username').first().text().trim();

        if (tweetContent) {
          return {
            title: `${username}: ${tweetContent.slice(0, 80)}...`,
            text: `Tweet by ${fullName} (${username}):\n\n${tweetContent}`,
            sourceType: 'url',
          };
        }
      } catch { continue; }
    }
  } catch { /* fallback below */ }

  throw new Error('Could not extract tweet content. X/Twitter blocks direct scraping. Try copying the tweet text manually.');
}

// ─── Reddit ──────────────────────────────────

async function extractReddit(url: string): Promise<ExtractedContent> {
  // Reddit serves JSON when you append .json to any URL
  const jsonUrl = url.replace(/\/?(\?.*)?$/, '.json$1');

  try {
    const res = await fetchPublicUrl(jsonUrl, {
      headers: {
        'User-Agent': 'Memorwise/1.0 (document extraction)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Reddit returned ${res.status}`);
    const data = JSON.parse(await readResponseText(res, 2 * 1024 * 1024)) as any;

    // Reddit returns an array: [post, comments]
    const listing = Array.isArray(data) ? data : [data];
    const post = listing[0]?.data?.children?.[0]?.data;

    if (!post) throw new Error('Could not parse Reddit response');

    const title = post.title || 'Reddit Post';
    const selftext = post.selftext || '';
    const author = post.author || 'unknown';
    const subreddit = post.subreddit_name_prefixed || '';
    const score = post.score || 0;
    const numComments = post.num_comments || 0;

    let text = `${subreddit} — Posted by u/${author} (${score} upvotes, ${numComments} comments)\n\n`;
    text += `# ${title}\n\n`;
    if (selftext) text += selftext + '\n\n';

    // Extract top comments
    if (listing[1]?.data?.children) {
      const topComments = listing[1].data.children
        .filter((c: any) => c.kind === 't1' && c.data?.body)
        .slice(0, 10);

      if (topComments.length > 0) {
        text += '---\n\n## Top Comments\n\n';
        for (const comment of topComments) {
          const c = comment.data;
          text += `**u/${c.author}** (${c.score} pts):\n${c.body}\n\n`;
        }
      }
    }

    return { title: `[Reddit] ${title}`, text, sourceType: 'url' };
  } catch (err) {
    // Fallback to regular web extraction
    return extractWebPage(url);
  }
}

// ─── GitHub ──────────────────────────────────

async function extractGitHub(owner: string, repo: string): Promise<ExtractedContent> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: { 'Accept': 'application/vnd.github.raw', 'User-Agent': 'Memorwise/1.0' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  const readme = await readResponseText(res, 2 * 1024 * 1024);

  let title = `${owner}/${repo}`;
  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Memorwise/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (repoRes.ok) {
      const repoData = await repoRes.json() as any;
      if (repoData.description) title = `${repoData.full_name} — ${repoData.description}`;
    }
  } catch { /* use default title */ }

  return { title, text: readme, sourceType: 'url' };
}

// ─── Generic Web Page ────────────────────────

async function extractWebPage(url: string): Promise<ExtractedContent> {
  const response = await fetchPublicUrl(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`);
  const html = await readResponseText(response);

  // Try to extract structured data (JSON-LD) for recipes, articles, etc.
  const $ = cheerio.load(html);
  const structuredData = extractStructuredData($);
  if (structuredData) return structuredData;

  // Use Readability for clean content extraction
  const doc = new JSDOM(html, { url });
  const reader = new Readability(doc.window.document);
  const article = reader.parse();

  if (!article || !article.textContent?.trim()) {
    $('script, style, nav, footer, header, iframe, noscript').remove();
    const fallbackText = $('body').text().replace(/\s+/g, ' ').trim();
    const fallbackTitle = $('title').text().trim() || url;
    return { title: fallbackTitle, text: fallbackText, sourceType: 'url' };
  }

  return { title: article.title || url, text: article.textContent.trim(), sourceType: 'url' };
}

// ─── Structured Data (JSON-LD) ───────────────

function extractStructuredData($: cheerio.CheerioAPI): ExtractedContent | null {
  const scripts = $('script[type="application/ld+json"]');
  if (scripts.length === 0) return null;

  for (let i = 0; i < scripts.length; i++) {
    try {
      const raw = $(scripts[i]).html();
      if (!raw) continue;
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        // Recipe
        if (item['@type'] === 'Recipe') {
          let text = `# ${item.name || 'Recipe'}\n\n`;
          if (item.description) text += `${item.description}\n\n`;
          if (item.prepTime || item.cookTime || item.totalTime) {
            text += '**Time:** ';
            if (item.prepTime) text += `Prep: ${formatDuration(item.prepTime)} `;
            if (item.cookTime) text += `Cook: ${formatDuration(item.cookTime)} `;
            if (item.totalTime) text += `Total: ${formatDuration(item.totalTime)}`;
            text += '\n\n';
          }
          if (item.recipeYield) text += `**Servings:** ${item.recipeYield}\n\n`;
          if (item.recipeIngredient) {
            text += '## Ingredients\n\n';
            for (const ing of item.recipeIngredient) text += `- ${ing}\n`;
            text += '\n';
          }
          if (item.recipeInstructions) {
            text += '## Instructions\n\n';
            const steps = Array.isArray(item.recipeInstructions) ? item.recipeInstructions : [item.recipeInstructions];
            steps.forEach((step: any, idx: number) => {
              const stepText = typeof step === 'string' ? step : step.text || step.name || '';
              if (stepText) text += `${idx + 1}. ${stepText}\n`;
            });
            text += '\n';
          }
          if (item.nutrition) {
            text += '## Nutrition\n\n';
            const n = item.nutrition;
            if (n.calories) text += `- Calories: ${n.calories}\n`;
            if (n.proteinContent) text += `- Protein: ${n.proteinContent}\n`;
            if (n.carbohydrateContent) text += `- Carbs: ${n.carbohydrateContent}\n`;
            if (n.fatContent) text += `- Fat: ${n.fatContent}\n`;
          }
          return { title: item.name || 'Recipe', text, sourceType: 'url' };
        }

        // Article
        if (item['@type'] === 'Article' || item['@type'] === 'NewsArticle' || item['@type'] === 'BlogPosting') {
          if (item.articleBody) {
            return { title: item.headline || item.name || 'Article', text: item.articleBody, sourceType: 'url' };
          }
        }
      }
    } catch { continue; }
  }

  return null;
}

function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const parts = [];
  if (match[1]) parts.push(`${match[1]}h`);
  if (match[2]) parts.push(`${match[2]}m`);
  if (match[3]) parts.push(`${match[3]}s`);
  return parts.join(' ') || iso;
}

// ─── Main Router ─────────────────────────────

export async function extractFromUrl(url: string): Promise<ExtractedContent> {
  if (isYouTubeUrl(url)) return extractYouTube(url);
  if (isTwitterUrl(url)) return extractTwitter(url);
  if (isRedditUrl(url)) return extractReddit(url);

  const ghRepo = isGitHubRepoUrl(url);
  if (ghRepo) {
    try { return await extractGitHub(ghRepo.owner, ghRepo.repo); }
    catch { /* fall through */ }
  }

  return extractWebPage(url);
}
