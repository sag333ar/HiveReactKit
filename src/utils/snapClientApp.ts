import type { Post } from '@/types/post';
import { parseJsonMetadata } from '@/components/feed/AttachmentStrip';

export interface SnapClientApp {
  id: string;
  label: string;
  iconUrl: string;
}

const HIVE_AVATAR = (account: string) =>
  `https://images.hive.blog/u/${encodeURIComponent(account)}/avatar`;

/** HiveSuite is the only client that stamps this developer + a `signature`. */
const HIVESUITE_DEVELOPER = 'sagarkothari88';

/**
 * Known posting clients. Keys are the `json_metadata.app` prefix
 * (everything before the first `/`). Unknown apps stay blank — we
 * never invent an avatar for them.
 */
export const SNAP_CLIENT_APPS: Record<string, Omit<SnapClientApp, 'id'>> = {
  hivesuite: { label: 'HiveSuite', iconUrl: HIVE_AVATAR('hivesuite.app') },
  peakd: { label: 'PeakD', iconUrl: HIVE_AVATAR('peakd') },
  ecency: { label: 'Ecency', iconUrl: HIVE_AVATAR('ecency.waves') },
  esteem: { label: 'Ecency', iconUrl: HIVE_AVATAR('ecency.waves') },
  leothreads: { label: 'LeoThreads', iconUrl: HIVE_AVATAR('leothreads') },
  inleo: { label: 'InLeo', iconUrl: HIVE_AVATAR('inleo') },
  leo: { label: 'InLeo', iconUrl: HIVE_AVATAR('inleo') },
  liketu: { label: 'Liketu', iconUrl: HIVE_AVATAR('liketu.moments') },
  slothbuzz: { label: 'SlothBuzz', iconUrl: HIVE_AVATAR('slothbuzz.hangs') },
  snapie: { label: 'Snapie', iconUrl: 'https://snapie.io/favicon.ico' },
  hivesnaps: { label: 'Snapie', iconUrl: 'https://snapie.io/favicon.ico' },
  zingit: {
    label: 'Zingit',
    iconUrl: 'https://images.hive.blog/p/KWcVEiwEzuiCBTwfYuGBSPQDkk5ieAch4R8vog3KPVNbFrbEPjEs7vGr7JJ32vV3JSECh3TTxe3VUBRqBc?width=128&height=128',
  },
  'hive-grove': { label: 'Hive Grove', iconUrl: 'https://hivegrove.up.railway.app/favicon.ico' },
  hivegrove: { label: 'Hive Grove', iconUrl: 'https://hivegrove.up.railway.app/favicon.ico' },
  hiveblog: { label: 'Hive.blog', iconUrl: HIVE_AVATAR('hiveio') },
  'hive.blog': { label: 'Hive.blog', iconUrl: HIVE_AVATAR('hiveio') },
};

export function snapClientAppId(rawApp: unknown): string {
  if (typeof rawApp !== 'string') return '';
  return rawApp.split('/')[0].trim().toLowerCase();
}

function hasNonEmpty(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  return value != null && value !== false;
}

export function isHiveSuiteClientMeta(meta: Record<string, unknown>): boolean {
  const developer = typeof meta.developer === 'string' ? meta.developer.trim().toLowerCase() : '';
  const dev = typeof meta.dev === 'string' ? meta.dev.trim().toLowerCase() : '';
  const isDeveloper = developer === HIVESUITE_DEVELOPER || dev === HIVESUITE_DEVELOPER;
  return isDeveloper && hasNonEmpty(meta.signature);
}

export function resolveSnapClientApp(
  post: Pick<Post, 'json_metadata'>,
  iconOverrides?: Partial<Record<string, string>>,
): SnapClientApp | null {
  const meta = parseJsonMetadata(post.json_metadata as unknown);
  const id = isHiveSuiteClientMeta(meta) ? 'hivesuite' : snapClientAppId(meta.app);
  if (!id) return null;

  const known = SNAP_CLIENT_APPS[id];
  if (!known) return null;

  return {
    id,
    label: known.label,
    iconUrl: iconOverrides?.[id] || known.iconUrl,
  };
}

/**
 * Fallback badge for snaps whose posting client has no known icon.
 * `name` is the raw `json_metadata.app` value with any `/version`
 * suffix stripped (e.g. `peakd/2024.1` → `peakd`), or `null` when the
 * metadata carries no app at all.
 */
export interface SnapClientAppBadge {
  name: string | null;
  /** Upper-case first letter / digit of `name`, or `?` when unknown. */
  initial: string;
  /** Human label — the app name, or `Unknown app`. */
  label: string;
  /** Deterministic background colour derived from `name`; `null` when unknown. */
  color: string | null;
}

export function resolveSnapClientAppBadge(
  post: Pick<Post, 'json_metadata'>,
): SnapClientAppBadge {
  const meta = parseJsonMetadata(post.json_metadata as unknown);
  const raw = typeof meta.app === 'string' ? meta.app.split('/')[0].trim() : '';
  if (!raw) return { name: null, initial: '?', label: 'Unknown app', color: null };
  const ch = raw.match(/[\p{L}\p{N}]/u)?.[0];
  let hash = 0;
  const key = raw.toLowerCase();
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return {
    name: raw,
    initial: ch ? ch.toUpperCase() : '?',
    label: raw,
    color: `hsl(${hue} 55% 38%)`,
  };
}
