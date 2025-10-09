import { useState } from "react";
import { ThumbsUp, X, Loader2 } from "lucide-react";

export function VoteSlider({
  author,
  permlink,
  defaultValue = 100,
  onUpvote,
  onCancel,
}: {
  author: string;
  permlink: string;
  defaultValue?: number;
  onUpvote: (percent: number) => Promise<void> | void; // allow async
  onCancel: () => void;
}) {
  const [percent, setPercent] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const stops = [1, ...Array.from({ length: 10 }, (_, i) => (i + 1) * 10)];

  const handleVoteClick = async () => {
    if (percent === 0 || loading) return;
    setLoading(true);
    try {
      await onUpvote(percent); // wait until API resolves
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl flex flex-col">
        {/* Header */}
        <h2 className="text-center text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-6">
          Vote for @{author}
        </h2>

        {/* Slider Section */}
        <div className="relative w-full flex flex-col items-center mb-8">
          {/* Floating bubble with percent */}
          <div
            className="absolute -top-8 left-0"
            style={{ left: `${percent}%`, transform: "translateX(-50%)" }}
          >
            <div className="bg-blue-600 text-white text-xs sm:text-sm px-2 py-1 rounded-lg shadow">
              {percent}%
            </div>
            <div className="mx-auto w-2 h-2 bg-blue-600 rotate-45 -mt-1"></div>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={1}
            max={100}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none bg-gray-200 dark:bg-gray-700 accent-blue-600 cursor-pointer"
          />

          {/* Stop Labels */}
          <div className="flex justify-between w-full mt-3 ml-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
            {stops.map((stop) => (
              <button
                type="button"
                key={stop}
                onClick={() => setPercent(stop)}
                className={`focus:outline-none px-1 rounded transition 
        ${
          percent === stop
            ? "text-blue-600 font-bold"
            : "hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-gray-700"
        }`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {stop}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleVoteClick}
            disabled={percent === 0 || loading}
            className={`flex-1 flex items-center justify-center rounded-full font-semibold transition
              text-sm sm:text-base px-3 py-2 sm:px-4 sm:py-3 shadow
              ${
                percent === 0 || loading
                  ? "bg-blue-300 text-white cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 animate-spin" />
                Voting...
              </>
            ) : (
              <>
                <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
                Vote
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={loading} // prevent cancel during vote
            className="flex-1 flex items-center justify-center rounded-full font-semibold text-sm sm:text-base px-3 py-2 sm:px-4 sm:py-3 shadow
              bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
