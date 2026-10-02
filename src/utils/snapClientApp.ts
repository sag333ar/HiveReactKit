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
