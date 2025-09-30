import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { CommunityFavouriteProvider } from "../../hooks/CommunityFavouriteProvider";

interface FavouriteWidgetProps {
  id: string;
  toastType: string;
  isLiked?: boolean;
  onAdd?: (id: string, action: "add_bookmark") => void;
  onRemove?: (id: string, action: "remove_bookmark") => void;
  onFavourite?: () => void;
}

const Favourite = ({
  id,
  toastType,
  isLiked,
  onAdd,
  onRemove,
  onFavourite,
}: FavouriteWidgetProps) => {
  const [liked, setLiked] = useState<boolean>(
    isLiked ?? CommunityFavouriteProvider.isUserPresentLocally(id)
  );

  useEffect(() => {
    if (isLiked !== undefined) {
      setLiked(isLiked);
    }
  }, [isLiked]);

  const toggleLike = () => {
    if (onFavourite) onFavourite();
    if (liked) {
      // remove
      if (onRemove) {
        onRemove(id, "remove_bookmark");
      } else {
        CommunityFavouriteProvider.storeLikedCommunityLocally(
          id,
          true
        );
      }
      showToast(false);
    } else {
      // add
      if (onAdd) {
        onAdd(id, "add_bookmark");
      } else {
        CommunityFavouriteProvider.storeLikedCommunityLocally(id);
      }
      showToast(true);
    }

    setLiked(!liked);
  };

  const showToast = (isAdding: boolean) => {
    const action = isAdding ? "added to" : "removed from";
    // simple toast with alert (replace with your Toast lib if available)
    alert(`The ${toastType} is ${action} your bookmarks`);
  };

  return (
    <button
      onClick={toggleLike}
      className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
    >
      {liked ? (
        <BookmarkCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      ) : (
        <Bookmark className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      )}
    </button>
  );
};

export default Favourite;
