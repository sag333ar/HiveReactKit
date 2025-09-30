const COMMUNITY_LOCAL_KEY = "_communityLocalKey";

export const CommunityFavouriteProvider = {
  getBookmarkedCommunities: (): string[] => {
    const data = localStorage.getItem(COMMUNITY_LOCAL_KEY);
    return data ? JSON.parse(data) : [];
  },

  isUserPresentLocally: (communityId: string): boolean => {
    const data = localStorage.getItem(COMMUNITY_LOCAL_KEY);
    if (!data) return false;
    const items: string[] = JSON.parse(data);
    return items.includes(communityId);
  },

  storeLikedCommunityLocally: (
    communityId: string,
    forceRemove: boolean = false
  ) => {
    let items: string[] = CommunityFavouriteProvider.getBookmarkedCommunities();

    if (items.includes(communityId)) {
      // remove
      items = items.filter((id) => id !== communityId);
    } else if (!forceRemove) {
      // add
      items.push(communityId);
    }

    localStorage.setItem(COMMUNITY_LOCAL_KEY, JSON.stringify(items));
    return items;
  },
};
