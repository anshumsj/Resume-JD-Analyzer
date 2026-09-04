/**
 * Web Search Learning Resource Enrichment Service
 *
 * Exclusively enriches identified learning roadmap items with real, authoritative
 * external learning resources (official documentation, tutorials, and getting-started guides).
 *
 * Strict Architectural Boundary:
 * This service must NEVER influence resume extraction, JD requirements, semantic matching,
 * numerical fit scoring, application recommendation, strengths, or gap priorities.
 */

/**
 * Decodes redirected search engine URLs (e.g. Base64 payload in Bing 'u=a1...' parameter)
 */
const decodeSearchUrl = (rawHref) => {
  try {
    const cleanHref = rawHref.replace(/&amp;/g, '&');
    const u = new URL(cleanHref);

    // Bing u=a1<base64>
    const uParam = u.searchParams.get('u');
    if (uParam && uParam.startsWith('a1')) {
      const b64 = uParam.slice(2);
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        return decoded;
      }
    }

    // DuckDuckGo uddg=<encoded>
    const uddg = u.searchParams.get('uddg');
    if (uddg) {
      return decodeURIComponent(uddg);
    }
  } catch (e) {
    // Fallback to raw href
  }
  return rawHref;
};

/**
 * Queries Bing web search for authoritative documentation & tutorials.
 */
export const searchBing = async (skill, options = {}) => {
  if (!skill || typeof skill !== 'string' || !skill.trim()) return [];
  const maxResults = options.maxResults || 3;
  const timeoutMs = options.timeoutMs || 6000;
  const query = `${skill.trim()} official documentation tutorial`;
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!res.ok) return [];

    const html = await res.text();
    const itemRegex = /<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>[\s\S]*?<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>/g;
    const results = [];
    const seenUrls = new Set();
    let match;

    while ((match = itemRegex.exec(html)) !== null && results.length < maxResults) {
      const targetUrl = decodeSearchUrl(match[1]);
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) continue;
      if (targetUrl.includes('bing.com')) continue;
      if (seenUrls.has(targetUrl)) continue;
      seenUrls.add(targetUrl);

      const title = match[2]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

      let source = 'web';
      try {
        source = new URL(targetUrl).hostname.replace(/^www\./, '');
      } catch (e) {}

      results.push({
        title: title || `${skill} Documentation`,
        url: targetUrl,
        source
      });
    }

    return results;
  } catch (err) {
    return [];
  }
};

/**
 * Queries DuckDuckGo HTML search for authoritative documentation & tutorials.
 */
export const searchDuckDuckGo = async (skill, options = {}) => {
  if (!skill || typeof skill !== 'string' || !skill.trim()) return [];
  const maxResults = options.maxResults || 3;
  const timeoutMs = options.timeoutMs || 6000;
  const query = `${skill.trim()} official documentation tutorial getting started`;
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!res.ok) return [];

    const html = await res.text();
    const linkRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const results = [];
    const seenUrls = new Set();
    let match;

    while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
      const targetUrl = decodeSearchUrl(match[1]);
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) continue;
      if (targetUrl.includes('duckduckgo.com')) continue;
      if (seenUrls.has(targetUrl)) continue;
      seenUrls.add(targetUrl);

      const title = match[2]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

      let source = 'web';
      try {
        source = new URL(targetUrl).hostname.replace(/^www\./, '');
      } catch (e) {}

      results.push({
        title: title || `${skill} Reference`,
        url: targetUrl,
        source
      });
    }

    return results;
  } catch (err) {
    return [];
  }
};

/**
 * Searches for authoritative learning resources with multi-engine fallback and timeout protection.
 *
 * @param {string} skill - The skill to search resources for
 * @param {Object} options - Configuration options (maxResults, timeoutMs)
 * @returns {Promise<Array<{title: string, url: string, source: string}>>}
 */
export const searchLearningResources = async (skill, options = {}) => {
  if (!skill || typeof skill !== 'string' || !skill.trim()) {
    return [];
  }

  // Try primary provider (Bing)
  const bingResults = await searchBing(skill, options);
  if (Array.isArray(bingResults) && bingResults.length > 0) {
    return bingResults;
  }

  // Fallback provider (DuckDuckGo)
  const ddgResults = await searchDuckDuckGo(skill, options);
  if (Array.isArray(ddgResults) && ddgResults.length > 0) {
    return ddgResults;
  }

  return [];
};

/**
 * Enriches a deterministic learning roadmap with real external learning resources.
 *
 * @param {Array<{skill: string}>} learningRoadmap - The identified roadmap items
 * @param {Object} options - Search options
 * @returns {Promise<Array<{skill: string, resources: Array<{title: string, url: string, source: string}>}>>}
 */
export const enrichLearningRoadmap = async (learningRoadmap = [], options = {}) => {
  if (!Array.isArray(learningRoadmap) || learningRoadmap.length === 0) {
    return [];
  }

  // Deduplicate skills to search only once per unique skill
  const uniqueSkills = Array.from(
    new Set(learningRoadmap.map(item => item?.skill).filter(Boolean))
  );

  if (uniqueSkills.length === 0) {
    return [];
  }

  // Fetch search resources concurrently for each unique roadmap skill
  const searchPromises = uniqueSkills.map(async (skill) => {
    try {
      const resources = await searchLearningResources(skill, options);
      return {
        skill,
        resources
      };
    } catch (err) {
      return {
        skill,
        resources: []
      };
    }
  });

  const settledResults = await Promise.all(searchPromises);

  // Map back matching original learning roadmap items
  const resourceMap = new Map();
  for (const item of settledResults) {
    resourceMap.set(item.skill, item.resources);
  }

  return learningRoadmap.map(item => ({
    skill: item.skill,
    resources: resourceMap.get(item.skill) || []
  }));
};
