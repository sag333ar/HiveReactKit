import { useState, type ReactNode } from 'react';
import { ChevronDown, MapPin, Link as LinkIcon, CalendarDays, MessageSquare, Sparkles, User } from 'lucide-react';

/** Where a section goes on the post details page (desktop/tablet ≥ 1024px). */
export type DetailPanelPlacement = 'left' | 'right' | 'bottom';
/** Author card: in a side panel, or 'top' = the normal byline only. */
export type DetailAuthorPlacement = 'left' | 'right' | 'top';

export interface PostDetailLayout {
  comments: DetailPanelPlacement;
  moreFromAuthor: DetailPanelPlacement;
  authorInfo: DetailAuthorPlacement;
}

export const DEFAULT_POST_DETAIL_LAYOUT: PostDetailLayout = {
  comments: 'bottom',
  moreFromAuthor: 'bottom',
  authorInfo: 'top',
};

export interface AuthorProfileData {
  username: string;
  name?: string;
  profileImage?: string;
  coverImage?: string;
  about?: string;
  location?: string;
  website?: string;
  created?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  reputation: number;
}

const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : n.toLocaleString());

/** Profile-header style card (avatar, cover, bio, location, website, joined, counts). */
export function AuthorInfoCard({
  profile,
  author,
  compact = false,
  onUserClick,
}: {
  profile: AuthorProfileData | null;
  author: string;
  compact?: boolean;
  onUserClick?: (username: string) => void;
}) {
  const avatar = profile?.profileImage || `https://images.hive.blog/u/${author}/avatar`;
  const joined = profile?.created ? new Date(profile.created).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null;
  const site = profile?.website?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <div className="hrk-author-card overflow-hidden rounded-2xl border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)]/60 shadow-lg backdrop-blur-md">
      {!compact && (
        <div
          className="h-20 bg-gradient-to-r from-red-600/40 via-purple-600/30 to-blue-600/30 bg-cover bg-center"
          style={profile?.coverImage ? { backgroundImage: `url(${profile.coverImage})` } : undefined}
        />
      )}
      <div className={compact ? 'p-3' : 'px-4 pb-4'}>
        <div className={`flex items-center gap-3 ${compact ? '' : '-mt-8'}`}>
          <img
            src={avatar}
            alt=""
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://images.hive.blog/u/${author}/avatar`; }}
            className={`${compact ? 'h-12 w-12' : 'h-16 w-16 border-4 border-[var(--hrk-bg-surface)]'} shrink-0 rounded-full bg-black/30 object-cover`}
          />
          <button type="button" onClick={() => onUserClick?.(author)} className={`min-w-0 text-left ${compact ? '' : 'mt-8'}`}>
            <div className="truncate text-sm font-semibold text-white">{profile?.name || author}</div>
            <div className="truncate text-xs text-[var(--hrk-text-tertiary)]">@{author}{profile?.reputation ? ` · ${profile.reputation}` : ''}</div>
          </button>
        </div>
        {profile?.about && <p className={`mt-3 text-xs leading-relaxed text-[var(--hrk-text-secondary)] ${compact ? 'line-clamp-2' : 'line-clamp-4'}`}>{profile.about}</p>}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--hrk-text-tertiary)]">
          {profile?.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{profile.location}</span>}
          {site && !compact && (
            <a href={profile!.website} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1 text-blue-400 hover:underline">
              <LinkIcon className="h-3 w-3 shrink-0" /><span className="truncate">{site}</span>
            </a>
          )}
          {joined && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />Joined {joined}</span>}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ['Followers', profile?.followersCount],
            ['Following', profile?.followingCount],
            ['Posts', profile?.postsCount],
          ].map(([label, v]) => (
            <div key={label as string} className="rounded-lg bg-[var(--hrk-bg-surface-raised)]/50 py-1.5">
              <div className="text-sm font-semibold text-white">{v == null ? '–' : fmt(v as number)}</div>
              <div className="text-[10px] text-[var(--hrk-text-tertiary)]">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Collapsible({ title, icon, children, defaultOpen = true }: { title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mt-4 rounded-2xl border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)]/40">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-white">
        <span className="flex items-center gap-2">{icon}{title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={open ? 'px-3 pb-3' : 'hidden'}>{children}</div>
    </section>
  );
}

/**
 * Post-detail layout with optional left/right sticky side panels.
 * Wide (≥1024px): the post stays centred (max-w-4xl); side panels are
 * sticky and scroll independently. Narrow: side choices are ignored and
 * everything stacks — post, compact author card, comments, more from author —
 * each section collapsible. Each node is rendered exactly once.
 */
export function ConfigurableDetailLayout({
  layout,
  isWide,
  post,
  comments,
  recsBottom,
  recsSide,
  authorCard,
}: {
  layout: PostDetailLayout;
  isWide: boolean;
  post: ReactNode;
  comments: ReactNode;
  recsBottom: ReactNode;
  recsSide: ReactNode | null;
  authorCard: ReactNode;
}) {
  if (!isWide) {
    return (
      <div className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:py-6">
          {post}
          {layout.authorInfo !== 'top' && (
            <Collapsible title="About the author" icon={<User className="h-4 w-4 text-blue-400" />}>{authorCard}</Collapsible>
          )}
          <Collapsible title="Comments" icon={<MessageSquare className="h-4 w-4 text-green-400" />}>{comments}</Collapsible>
          {recsSide && (
            <Collapsible title="More from author" icon={<Sparkles className="h-4 w-4 text-yellow-500" />}>{recsSide}</Collapsible>
          )}
          <div className="h-16" />
        </div>
      </div>
    );
  }
  const left: ReactNode[] = [];
  const right: ReactNode[] = [];
  const put = (where: string, node: ReactNode) => (where === 'left' ? left.push(node) : where === 'right' ? right.push(node) : null);
  if (layout.authorInfo !== 'top') put(layout.authorInfo, <div key="author">{authorCard}</div>);
  if (layout.comments !== 'bottom') put(layout.comments, <div key="comments" className="hrk-side-comments rounded-2xl border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)]/40 p-3">{comments}</div>);
  if (layout.moreFromAuthor !== 'bottom' && recsSide) put(layout.moreFromAuthor, <div key="recs">{recsSide}</div>);
  const aside = (nodes: ReactNode[], side: string) =>
    nodes.length ? (
      <aside
        data-panel={side}
        className="sticky top-[72px] w-[320px] xl:w-[380px] 2xl:w-[420px] shrink-0 max-h-[calc(100vh-88px)] overflow-y-auto space-y-4 pr-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {nodes}
      </aside>
    ) : (
      <div className="hidden 2xl:block w-[420px] shrink-0" aria-hidden />
    );
  return (
    <div className="flex-1">
      <div className="mx-auto flex max-w-[1880px] items-start justify-center gap-6 px-4 py-4 sm:py-6">
        {aside(left, 'left')}
        <div className="min-w-0 max-w-4xl flex-1">
          {post}
          {layout.comments === 'bottom' && comments}
          {layout.moreFromAuthor === 'bottom' && recsBottom}
        </div>
        {aside(right, 'right')}
      </div>
    </div>
  );
}
