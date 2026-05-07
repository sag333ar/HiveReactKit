/**
 * Parser for the WorldMappin marker that authors embed in Hive post bodies:
 *
 *   [//]:# (!worldmappin <lat> lat <lng> long <description> d3scr)
 *
 * The pattern is a markdown comment so non-WorldMappin renderers swallow it,
 * but the structured `lat`/`long`/`d3scr` keywords let any tool that knows
 * the convention (worldmappin.com itself, Ecency, etc.) extract the pin.
 *
 * The regex is intentionally tolerant of whitespace and signed/decimal
 * numbers; `description` is captured greedily up to the trailing `d3scr`
 * sentinel and trimmed.
 */

export interface WorldMappinPin {
  lat: number;
  lng: number;
  description: string;
  /** The exact marker substring matched in the body (use to strip it). */
  raw: string;
}

const WORLD_MAPPIN_RE =
  /\[\/\/\]:#\s*\(\s*!worldmappin\s+(-?\d+(?:\.\d+)?)\s+lat\s+(-?\d+(?:\.\d+)?)\s+long\s+([\s\S]*?)\s+d3scr\s*\)/gi;

/** Pull every WorldMappin marker out of a post body. */
export function extractWorldMappinPins(body: string): WorldMappinPin[] {
  if (!body) return [];
  const out: WorldMappinPin[] = [];
  // Reset lastIndex defensively since the regex carries state across calls.
  WORLD_MAPPIN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORLD_MAPPIN_RE.exec(body)) !== null) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      lat,
      lng,
      description: m[3].trim(),
      raw: m[0],
    });
  }
  return out;
}

/** Convenience — returns the first pin (most posts only have one). */
export function extractWorldMappinPin(body: string): WorldMappinPin | null {
  return extractWorldMappinPins(body)[0] ?? null;
}

/** Strip every WorldMappin marker from the body. */
export function stripWorldMappinMarkers(body: string): string {
  if (!body) return body;
  return body.replace(WORLD_MAPPIN_RE, "").replace(/\n{3,}/g, "\n\n");
}
