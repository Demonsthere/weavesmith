import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { PatternError, fromJSON, gcPalette, toJSON } from '@weavesmith/core';
import type { Pattern } from '@weavesmith/core';

/** Longest encoded pattern we will put in a URL. Beyond this, offer the file. */
export const SHARE_LIMIT = 1800;

/**
 * `String.fromCharCode(...bytes)` is the obvious spelling and blows the call
 * stack once the band is big — which is exactly the case that reaches here,
 * since oversized bands must be *measured* before they can be refused.
 * Chunked instead.
 */
const CHUNK = 0x8000;

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

export function encodePattern(pattern: Pattern): string {
  // gcPalette throws PatternError on a corrupt palette or an out-of-range
  // colour index. Let it: a share link for a broken band is worse than a
  // refusal, and the caller has a PatternError path already.
  return toBase64Url(deflateSync(strToU8(toJSON(gcPalette(pattern))), { level: 9 }));
}

export function decodePattern(hash: string): Pattern {
  try {
    return fromJSON(strFromU8(inflateSync(fromBase64Url(hash))));
  } catch (error) {
    if (error instanceof PatternError) throw error;
    throw new PatternError(['this link is damaged or was not made by WeaveSmith']);
  }
}

/**
 * The full URL to paste to someone, for the page this app is served from.
 * Takes the already-encoded payload rather than the pattern: the caller has
 * to measure that string against `SHARE_LIMIT` anyway, and encoding a large
 * band twice to answer one question is the expensive half of this module.
 */
export function linkFor(encoded: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#p=${encoded}`;
}
