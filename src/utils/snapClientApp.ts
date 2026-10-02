import type { Post } from '@/types/post';
import { hasHivesuiteFamilyTag, parseJsonMetadata } from '@/components/feed/AttachmentStrip';

export interface SnapClientApp {
  id: string;
  label: string;
  iconUrl: string;
}

const HIVE_AVATAR = (account: string) =>
  `https://images.hive.blog/u/${encodeURIComponent(account)}/avatar`;

/**
 * Known posting clients. Keys are the `json_metadata.app` prefix
 * (everything before the first `/`). HiveSuite family posts are
 * resolved first in `resolveSnapClientApp` because HiveSuite still
 * stamps PeakD / Ecency / Leo app strings when publishing into those
 * containers.
 */
export const SNAP_CLIENT_APPS: Record<string, Omit<SnapClientApp, 'id'>> = {
  hivesuite: { label: 'HiveSuite', iconUrl: HIVE_AVATAR('hivesuite.app') },
  hsnaps: { label: 'HiveSuite', iconUrl: HIVE_AVATAR('hivesuite.app') },
  hreplier: { label: 'HiveSuite', iconUrl: HIVE_AVATAR('hivesuite.app') },
  hcurators: { label: 'HiveSuite', iconUrl: HIVE_AVATAR('hivesuite.app') },
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

const HIVESUITE_APP_IDS = new Set(['hivesuite', 'hsnaps', 'hreplier', 'hcurators']);

/** Hive usernames are 3–16 chars of a-z, 0-9, and `.`. */
const HIVE_ACCOUNT_RE = /^[a-z][a-z0-9.]{2,15}$/;

export function snapClientAppId(rawApp: unknown): string {
  if (typeof rawApp !== 'string') return '';
  return rawApp.split('/')[0].trim().toLowerCase();
}

export function resolveSnapClientApp(
  post: Pick<Post, 'json_metadata'>,
  iconOverrides?: Partial<Record<string, string>>,
): SnapClientApp | null {
  const meta = parseJsonMetadata(post.json_metadata as unknown);
  const appId = snapClientAppId(meta.app);
  const isHiveSuite =
    HIVESUITE_APP_IDS.has(appId) ||
    appId.startsWith('hivesuite') ||
    hasHivesuiteFamilyTag(post as Post);

  const id = isHiveSuite ? 'hivesuite' : appId;
  if (!id) return null;

  const known = SNAP_CLIENT_APPS[id];
  const label = known?.label ?? id;
  const iconUrl = iconOverrides?.[id] || known?.iconUrl || (
    HIVE_ACCOUNT_RE.test(id) ? HIVE_AVATAR(id) : ''
  );
  if (!iconUrl) return null;

  return { id, label, iconUrl };
}
