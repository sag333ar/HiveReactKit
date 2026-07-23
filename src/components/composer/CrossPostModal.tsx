/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { X, Share2, Loader2, AlertCircle, ChevronDown } from 'lucide-react';

export interface CommunitySubscription {
  id: string;
  name: string;
  role?: string;
  title?: string;
}

export interface CrossPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: {
    author: string;
    permlink: string;
    title?: string;
    category?: string;
  };
  currentUser?: string;
  userCommunities?: CommunitySubscription[];
  onConfirmCrossPost: (targetCommunity: string, userNote: string) => Promise<boolean | void>;
}

/** Fallback default communities if user has no active subscriptions */
const FALLBACK_COMMUNITIES: CommunitySubscription[] = [
  { id: 'hive-185924', name: 'HiveSuite Community' },
  { id: 'hive-181436', name: 'GEMS' },
  { id: 'hive-167922', name: 'LeoFinance' },
  { id: 'hive-148441', name: 'Hive Learners' },
  { id: 'hive-120586', name: 'Foodies Bee Hive' },
  { id: 'hive-174578', name: 'Ecency' },
  { id: 'hive-105017', name: 'HiveDevs' },
];

export function CrossPostModal({
  isOpen,
  onClose,
  post,
  currentUser,
  userCommunities,
  onConfirmCrossPost,
}: CrossPostModalProps) {
  const [communities, setCommunities] = useState<CommunitySubscription[]>(userCommunities || []);
  const [loadingCommunities, setLoadingCommunities] = useState(false);
  const [targetCommunity, setTargetCommunity] = useState('');
  const [userNote, setUserNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch subscribed communities for currentUser if not explicitly provided
  useEffect(() => {
    if (!isOpen) return;

    setUserNote('');
    setError(null);
    setSubmitting(false);

    if (userCommunities && userCommunities.length > 0) {
      setCommunities(userCommunities);
      setTargetCommunity(userCommunities[0].id);
      return;
    }

    if (!currentUser) {
      setCommunities(FALLBACK_COMMUNITIES);
      setTargetCommunity(FALLBACK_COMMUNITIES[0].id);
      return;
    }

    let active = true;
    setLoadingCommunities(true);

    fetch('https://api.hive.blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'bridge.list_all_subscriptions',
        params: { account: currentUser },
        id: 1,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.result && Array.isArray(data.result) && data.result.length > 0) {
          const list: CommunitySubscription[] = data.result.map((item: any) => ({
            id: item[0],
            name: item[1] || item[0],
            role: item[2],
            title: item[3],
          }));
          setCommunities(list);
          setTargetCommunity(list[0].id);
        } else {
          setCommunities(FALLBACK_COMMUNITIES);
          setTargetCommunity(FALLBACK_COMMUNITIES[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch subscribed communities:', err);
        if (active) {
          setCommunities(FALLBACK_COMMUNITIES);
          setTargetCommunity(FALLBACK_COMMUNITIES[0].id);
        }
      })
      .finally(() => {
        if (active) setLoadingCommunities(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, currentUser, userCommunities]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanComm = targetCommunity.trim().toLowerCase();
    if (!cleanComm) {
      setError('Please select a target community');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await onConfirmCrossPost(cleanComm, userNote.trim());
      if (res !== false) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish cross post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/90">
          <h2 className="text-lg font-semibold text-white">Cross Post in a Community</h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Target Community Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Where to share this post: <span className="text-red-400">*</span>
            </label>

            {loadingCommunities ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-700 bg-gray-800/80 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span>Loading your subscribed communities...</span>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={targetCommunity}
                  onChange={(e) => setTargetCommunity(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-700 bg-gray-800/90 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all pr-10 cursor-pointer"
                  required
                >
                  {communities.map((comm) => (
                    <option key={comm.id} value={comm.id} className="bg-gray-900 text-white py-1">
                      {comm.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
            )}
          </div>

          {/* User Message / Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Add Message / Note <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              rows={4}
              placeholder="Add a message or context to your cross post (e.g. 'this is a test cross post')..."
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800/90 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !targetCommunity}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white transition-colors disabled:opacity-50 shadow-lg shadow-blue-600/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>CROSS POST</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CrossPostModal;
