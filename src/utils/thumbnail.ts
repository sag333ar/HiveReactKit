export const formatThumbnailUrl = (thumbnail?: string): string => {
  if (!thumbnail) {
    return '/placeholder.svg';
  }

  // Handle IPFS URLs
  if (thumbnail.startsWith('Qm') || thumbnail.startsWith('baf')) {
    return `https://ipfs-3speak.b-cdn.net/ipfs/${thumbnail}`;
  }

  // Handle already formatted URLs
  if (thumbnail.startsWith('http')) {
    return thumbnail;
  }

  // Handle relative paths
  if (thumbnail.startsWith('/')) {
    return `https://3speak.tv${thumbnail}`;
  }

  // Default fallback
  return thumbnail;
};