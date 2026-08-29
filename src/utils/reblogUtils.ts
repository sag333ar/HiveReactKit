/**
 * Utility to extract reblog / re-snap metadata from Hive post objects.
 * Supports `reblogged_by` (array or string), `first_reblogged_by`, and `reblog_by`.
 */

export function getRebloggedBy(post: any): string | null {
  if (!post) return null;
  const authorLower = (post.author || '').toLowerCase();

  if (Array.isArray(post.reblogged_by) && post.reblogged_by.length > 0) {
    const candidate = post.reblogged_by[0];
    if (typeof candidate === 'string' && candidate.trim() && candidate.trim().toLowerCase() !== authorLower) {
      return candidate.trim();
    }
  }

  if (typeof post.first_reblogged_by === 'string' && post.first_reblogged_by.trim() && post.first_reblogged_by.trim().toLowerCase() !== authorLower) {
    return post.first_reblogged_by.trim();
  }

  if (typeof post.reblogged_by === 'string' && post.reblogged_by.trim() && post.reblogged_by.trim().toLowerCase() !== authorLower) {
    return post.reblogged_by.trim();
  }

  if (Array.isArray(post.reblog_by) && post.reblog_by.length > 0) {
    const candidate = post.reblog_by[0];
    if (typeof candidate === 'string' && candidate.trim() && candidate.trim().toLowerCase() !== authorLower) {
      return candidate.trim();
    }
  }

  return null;
}

export function getRebloggedByList(post: any): string[] {
  if (!post) return [];
  const authorLower = (post.author || '').toLowerCase();
  const list: string[] = [];

  if (Array.isArray(post.reblogged_by)) {
    for (const item of post.reblogged_by) {
      if (typeof item === 'string' && item.trim() && item.trim().toLowerCase() !== authorLower && !list.includes(item.trim())) {
        list.push(item.trim());
      }
    }
  } else if (typeof post.reblogged_by === 'string' && post.reblogged_by.trim() && post.reblogged_by.trim().toLowerCase() !== authorLower) {
    list.push(post.reblogged_by.trim());
  }

  if (typeof post.first_reblogged_by === 'string' && post.first_reblogged_by.trim() && post.first_reblogged_by.trim().toLowerCase() !== authorLower && !list.includes(post.first_reblogged_by.trim())) {
    list.push(post.first_reblogged_by.trim());
  }

  if (Array.isArray(post.reblog_by)) {
    for (const item of post.reblog_by) {
      if (typeof item === 'string' && item.trim() && item.trim().toLowerCase() !== authorLower && !list.includes(item.trim())) {
        list.push(item.trim());
      }
    }
  }

  return list;
}
