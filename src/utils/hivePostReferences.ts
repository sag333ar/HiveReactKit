import { parseHiveFrontendUrl } from './hiveLinks';
import type { Post } from '@/types/post';

export interface HivePostReference {
  author: string;
  permlink: string;
}

function cleanCandidateUrl(raw: string): string {
  return raw.trim().replace(/[)\],.;:>\s"'<]+$/, '');
}

function toPostReference(raw: string): HivePostReference | null {
  const target = parseHiveFrontendUrl(cleanCandidateUrl(raw));
  return target && target.kind === 'post'
    ? { author: target.author, permlink: target.permlink }
    : null;
}

export function detectHivePostReference(body: string): HivePostReference | null {
  const trimmed = (body || '').trim();
  if (!trimmed) return null;

  if (/^https?:\/\/\S+$/.test(trimmed)) return toPostReference(trimmed);

  const mdOnly = trimmed.match(/^\[[^\]]*\]\((https?:\/\/[^)\s]+)\)$/);
  if (mdOnly) return toPostReference(mdOnly[1]);

  const anchorOnly = trimmed.match(/^<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>[^<]*<\/a>$/i);
  if (anchorOnly) return toPostReference(anchorOnly[1]);

  const inlineMd = trimmed.match(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
  if (inlineMd) {
    const target = toPostReference(inlineMd[1]);
    if (target) return target;
  }

  const inlineAnchor = trimmed.match(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>[^<]*<\/a>/i);
  if (inlineAnchor) {
    const target = toPostReference(inlineAnchor[1]);
    if (target) return target;
  }

  const urlRe = /https?:\/\/[^\s"'<>)\]]+/g;
  let match: RegExpExecArray | null;
  while ((match = urlRe.exec(trimmed)) !== null) {
    const target = toPostReference(match[0]);
    if (target) return target;
  }
  return null;
}

export function stripHivePostReference(body: string, target: HivePostReference | null): string {
  if (!target) return body;
  const matchesTarget = (raw: string) => {
    const parsed = toPostReference(raw);
    return parsed?.author === target.author && parsed.permlink === target.permlink;
  };

  let stripped = body.replace(
    /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g,
    (match, url: string) => matchesTarget(url) ? '' : match,
  );
  stripped = stripped.replace(
    /<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>[^<]*<\/a>/gi,
    (match, url: string) => matchesTarget(url) ? '' : match,
  );
  stripped = stripped.replace(/https?:\/\/[^\s"'<>)\]]+/g, (url) => (
    matchesTarget(url) ? '' : url
  ));
  return stripped.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function getHivePostLevel(post: Post): number {
  const raw = (post as unknown as { level?: unknown; depth?: unknown }).level ?? post.depth;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return post.parent_author ? 1 : 0;
}
