import type { ModelSource } from './licenses';

export interface ParsedModelUrl {
  source: ModelSource;
  externalId: string;
  /** One address per model, whatever language or slug the pasted link had. */
  url: string;
}

const PATTERNS: Array<{
  source: ModelSource;
  host: RegExp;
  path: RegExp;
  canonical: (id: string) => string;
}> = [
  {
    // makerworld.com/en/models/1363398-ams-flipper#profileId-3067475
    canonical: (id) => `https://makerworld.com/en/models/${id}`,
    host: /^(www\.)?makerworld\.com$/,
    path: /^\/(?:[a-z]{2}(?:-[a-z]{2,4})?\/)?models\/(\d+)/i,
    source: 'makerworld',
  },
  {
    // printables.com/model/3161-3d-benchy, printables.com/cs/model/3161
    canonical: (id) => `https://www.printables.com/model/${id}`,
    host: /^(www\.)?printables\.com$/,
    path: /^\/(?:[a-z]{2}\/)?model\/(\d+)/i,
    source: 'printables',
  },
  {
    // thingiverse.com/thing:763622
    canonical: (id) => `https://www.thingiverse.com/thing:${id}`,
    host: /^(www\.)?thingiverse\.com$/,
    path: /^\/thing:(\d+)/i,
    source: 'thingiverse',
  },
];

/** The site and model id of a pasted link, or null when it is not a model page we know. */
export function parseModelUrl(input: string): ParsedModelUrl | null {
  let url: URL;
  try {
    const text = input.trim();
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  for (const pattern of PATTERNS) {
    if (!pattern.host.test(host)) continue;
    const id = pattern.path.exec(url.pathname)?.[1];
    if (!id) return null;
    return {
      externalId: id,
      source: pattern.source,
      url: pattern.canonical(id),
    };
  }
  return null;
}
