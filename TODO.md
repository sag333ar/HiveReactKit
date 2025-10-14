# TODO: Add Infinite Scrolling Pagination to PostFeedList

## Steps to Complete

- [x] Update `apiService.ts` to support pagination in `getRankedPosts` by adding `start_author` and `start_permlink` parameters.
- [x] Modify `PostFeedList.tsx` to add state for pagination: `hasMore`, `loadingMore`, and track the last post for pagination.
- [x] Implement IntersectionObserver in `PostFeedList.tsx` to detect when the last post is in view and trigger loading more posts.
- [x] Update the `fetchPosts` function in `PostFeedList.tsx` to append new posts instead of replacing the list when loading more.
- [x] Handle loading states and errors for the infinite scroll functionality.
- [x] Test the infinite scrolling by scrolling to the bottom and verifying more posts load until no more data.
