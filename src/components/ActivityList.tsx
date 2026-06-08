/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  FileText,
  MessageCircle,
  RefreshCw,
  Clock,
  Wallet,
  Eye,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Search,
  DollarSign,
  User,
  ChevronDown,
  Check,
  X,
  Send,
} from "lucide-react";
import { activityListService, buildOperationFilterMask } from "@/services/activityListService";
import { getHiveApiEndpoint } from "@/config/hiveEndpoint";
import {
  ActivityListItem,
  DirectionFilter,
  OperationFilter,
  OPERATION_FILTER_GROUPS,
} from "@/types/activityList";

interface OperationFilterDropdownProps {
  value: OperationFilter;
  onChange: (value: OperationFilter) => void;
}

const OperationFilterDropdown: React.FC<OperationFilterDropdownProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = useMemo(() => {
    if (value === "all") return "All";
    for (const group of OPERATION_FILTER_GROUPS) {
      const opt = group.options.find(o => o.value === value);
      if (opt) return opt.label;
    }
    return "All";
  }, [value]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OPERATION_FILTER_GROUPS;
    return OPERATION_FILTER_GROUPS
      .map(group => ({
        ...group,
        options: group.options.filter(
          o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
        ),
      }))
      .filter(group => group.options.length > 0);
  }, [query]);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the search input when the panel opens.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [open]);

  const pick = (next: OperationFilter) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-1.5 rounded-md border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)] px-2 py-1.5 text-xs text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--hrk-info)] sm:px-3 sm:py-2 sm:text-sm"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          {/* Mobile backdrop — taps anywhere outside the panel close it. */}
          <div
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <div
            role="listbox"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col rounded-t-xl border-t border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-1 sm:max-h-[60vh] sm:w-72 sm:rounded-lg sm:border sm:border-[var(--hrk-border-subtle)]"
          >
            {/* Header / search */}
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-[var(--hrk-text-tertiary)]" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search filter…"
                className="w-full bg-transparent text-sm text-[var(--hrk-text-primary)] placeholder-[var(--hrk-text-tertiary)] focus:outline-none dark:text-[var(--hrk-text-primary)]"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-hover)] dark:text-[var(--hrk-text-tertiary)] dark:hover:bg-[var(--hrk-bg-surface-raised)] sm:hidden"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Options */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-1">
              {/* "All" — always visible unless filtered out by the query. */}
              {(query.trim() === "" || "all".includes(query.trim().toLowerCase())) && (
                <button
                  type="button"
                  onClick={() => pick("all")}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                    value === "all"
                      ? "bg-[var(--hrk-brand)] text-[var(--hrk-text-on-brand)]"
                      : "text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface-raised)]"
                  }`}
                >
                  <span>All</span>
                  {value === "all" && <Check className="h-4 w-4" />}
                </button>
              )}

              {filteredGroups.map(group => (
                <div key={group.label} className="mt-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)]">
                    {group.label}
                  </div>
                  {group.options.map(opt => {
                    const selected = value === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => pick(opt.value)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                          selected
                            ? "bg-[var(--hrk-brand)] text-[var(--hrk-text-on-brand)]"
                            : "text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface-raised)]"
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {selected && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))}

              {filteredGroups.length === 0 && query.trim() !== "" && (
                <div className="px-3 py-4 text-center text-sm text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)]">
                  No filters match "{query}"
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface ActivityListProps {
  username: string;
  directionFilter?: DirectionFilter;
  operationFilter?: OperationFilter;
  limit?: number;
  className?: string;
  onClickPermlink?: (author: string, permlink: string) => void;
  onSelectActivity?: (activity: ActivityListItem) => void;
  /** The actual scroll container this list lives inside. When provided,
   *  infinite scroll attaches to it directly instead of guessing the
   *  nearest scrollable ancestor — the guess is unreliable in nested
   *  layouts (e.g. embedded in UserDetailProfile) where an inner
   *  `overflow-y-auto` wrapper grows to content height and never
   *  actually scrolls. */
  scrollRootRef?: React.RefObject<HTMLElement | null>;
}

const ActivityList: React.FC<ActivityListProps> = ({
  username,
  directionFilter = 'all',
  operationFilter = 'all',
  limit = 20,
  className,
  onClickPermlink,
  onSelectActivity,
  scrollRootRef,
}) => {
  const [localDirectionFilter, setLocalDirectionFilter] = useState(directionFilter);
  const [localOperationFilter, setLocalOperationFilter] = useState<OperationFilter>(operationFilter);
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastIndex, setLastIndex] = useState<number>(-1);
const dropdownRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const lastIndexRef = useRef<number>(-1);
  const hasMoreRef = useRef<boolean>(true);
  const isLoadingRef = useRef<boolean>(false);
  const isIntersectingRef = useRef<boolean>(false);
  // HIVE-per-VEST ratio, used to display stake / unstake / delegate
  // operations in HP (the chain stores them as raw VESTS).
  const [vestsToHp, setVestsToHp] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(getHiveApiEndpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'condenser_api.get_dynamic_global_properties',
        params: [],
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const tvfh = parseFloat(d?.result?.total_vesting_fund_hive ?? '0');
        const tvs = parseFloat(d?.result?.total_vesting_shares ?? '0');
        if (tvs > 0) setVestsToHp(tvfh / tvs);
      })
      .catch(() => { /* HP labels fall back to raw VESTS */ });
    return () => { cancelled = true; };
  }, []);

  /** Convert a `"123.456789 VESTS"` asset string to an `"X.XXX HP"`
   *  display. Falls back to the raw string until the ratio loads. */
  const vestsToHpLabel = useCallback((vests?: string): string => {
    if (!vests) return '';
    const n = parseFloat(vests);
    if (!Number.isFinite(n)) return vests;
    if (vestsToHp == null) return vests;
    return `${(n * vestsToHp).toLocaleString(undefined, { maximumFractionDigits: 3 })} HP`;
  }, [vestsToHp]);

  /** Right-side value(s) for an activity row, formatted per operation
   *  type — mirrors the wallet Transactions view (amount + counterparty
   *  / order id / target post, etc.). Returns null for ops with nothing
   *  meaningful to show. `transfer` keeps its own dedicated renderer. */
  const renderActivityValue = useCallback((a: ActivityListItem): React.ReactNode => {
    const d = (a.details ?? {}) as Record<string, any>;
    const amount = (text?: string) =>
      text ? <span className="whitespace-nowrap text-sm font-semibold text-[var(--hrk-text-primary)] dark:text-white">{text}</span> : null;
    const account = (name?: string) =>
      name ? <span className="truncate text-sm font-medium text-green-600 dark:text-green-400">@{name}</span> : null;
    const muted = (text?: string) =>
      text ? <span className="whitespace-nowrap text-xs text-[var(--hrk-text-tertiary)]">{text}</span> : null;
    const row = (children: React.ReactNode) => (
      <div className="flex items-center justify-end gap-1.5 min-w-0">{children}</div>
    );
    // Join several non-zero asset strings (e.g. reward = HIVE + HBD + HP)
    // into one compact "·"-separated amount label.
    const amounts = (...parts: (string | undefined)[]) => {
      const shown = parts
        .map((p) => {
          if (!p) return null;
          // Convert VESTS payouts to HP for display.
          if (p.endsWith('VESTS')) {
            const hp = vestsToHpLabel(p);
            return parseFloat(hp) > 0 ? hp : null;
          }
          return parseFloat(p) > 0 ? p : null;
        })
        .filter(Boolean) as string[];
      return shown.length ? amount(shown.join(' · ')) : null;
    };

    switch (a.op) {
      case 'transfer_to_vesting':
        return amount(d.amount);
      case 'withdraw_vesting':
        return amount(vestsToHpLabel(d.vesting_shares));
      case 'delegate_vesting_shares':
        return row(<>{account(d.delegatee)}<span className="text-[var(--hrk-text-tertiary)]">|</span>{amount(vestsToHpLabel(d.vesting_shares))}</>);
      case 'delete_comment':
        return row(<>{account(d.author)}<span className="text-[var(--hrk-text-tertiary)]">/</span>{muted(d.permlink)}</>);
      case 'cancel_transfer_from_savings':
      case 'set_withdraw_vesting_route':
        return null;
      case 'limit_order_create':
      case 'limit_order_create2':
        return (
          <div className="flex flex-col items-end gap-0.5">
            {row(<>{amount(d.amount_to_sell)}<span className="text-[var(--hrk-text-tertiary)]">⇄</span>{amount(d.min_to_receive)}</>)}
            {muted(d.orderid != null ? `ID: #${d.orderid}` : undefined)}
          </div>
        );
      case 'limit_order_cancel':
        return muted(d.orderid != null ? `ID: #${d.orderid}` : undefined);
      case 'convert':
      case 'collateralized_convert':
        return amount(d.amount);
      case 'fill_order':
        return row(<>{account(d.current_owner === username ? d.open_owner : d.current_owner)}<span className="text-[var(--hrk-text-tertiary)]">|</span>{amount(`${d.current_pays} of ${d.open_pays}`)}</>);
      case 'fill_transfer_from_savings':
        return row(<>{account(d.to)}<span className="text-[var(--hrk-text-tertiary)]">|</span>{amount(d.amount)}</>);
      case 'fill_convert_request':
        return row(<>{amount(d.amount_out)}{muted('IN')}</>);
      case 'fill_vesting_withdraw':
        return row(<>{account(d.to_account)}<span className="text-[var(--hrk-text-tertiary)]">|</span>{amount(d.deposited)}</>);

      // ── Social ──────────────────────────────────────────────────
      case 'vote':
        return row(<>{account(d.author)}<span className="text-[var(--hrk-text-tertiary)]">|</span>{amount(typeof d.weight === 'number' ? `${(d.weight / 100).toFixed(0)}%` : undefined)}</>);
      case 'comment':
        return d.parent_author
          ? row(<>{muted('reply to')}{account(d.parent_author)}</>)
          : account(d.author);

      // ── Reward distribution ─────────────────────────────────────
      case 'claim_reward_balance':
        return amounts(d.reward_hive, d.reward_hbd, d.reward_vests);
      case 'comment_reward':
        return amount(d.payout);
      case 'author_reward':
        return amounts(d.hive_payout, d.hbd_payout, d.vesting_payout);
      case 'curation_reward':
        return row(<>{account(d.comment_author ?? d.author)}<span className="text-[var(--hrk-text-tertiary)]">|</span>{amount(vestsToHpLabel(d.reward))}</>);
      case 'comment_benefactor_reward':
        return row(<>{account(d.author)}<span className="text-[var(--hrk-text-tertiary)]">|</span>{amounts(d.hive_payout, d.hbd_payout, d.vesting_payout)}</>);
      case 'interest':
        return amount(d.interest);

      // ── Governance ──────────────────────────────────────────────
      case 'account_witness_vote':
        return row(<>{account(d.witness)}<span className="text-[var(--hrk-text-tertiary)]">|</span>{muted(d.approve ? 'Approve' : 'Unapprove')}</>);
      case 'account_witness_proxy':
        return d.proxy ? row(<>{muted('proxy')}{account(d.proxy)}</>) : muted('Cleared proxy');
      case 'update_proposal_votes':
        return row(<>{muted(Array.isArray(d.proposal_ids) ? `#${d.proposal_ids.join(', #')}` : undefined)}{muted(d.approve ? 'Approve' : 'Unapprove')}</>);
      case 'feed_publish':
        return amount(d.exchange_rate?.base);
      case 'create_proposal':
        return amount(d.daily_pay);
      case 'remove_proposal':
        return muted(Array.isArray(d.proposal_ids) ? `#${d.proposal_ids.join(', #')}` : undefined);
      case 'decline_voting_rights':
        return muted(d.decline ? 'Decline' : 'Cancel decline');

      // ── Account management ──────────────────────────────────────
      case 'account_create':
      case 'account_create_with_delegation':
      case 'create_claimed_account':
        return account(d.new_account_name);
      case 'claim_account':
        return amount(d.fee);
      case 'change_recovery_account':
        return account(d.new_recovery_account);

      // ── Escrow ──────────────────────────────────────────────────
      case 'escrow_transfer':
        return row(<>{account(d.to)}<span className="text-[var(--hrk-text-tertiary)]">|</span>{amounts(d.hive_amount, d.hbd_amount)}</>);
      case 'escrow_release':
        return amounts(d.hive_amount, d.hbd_amount);

      default:
        return null;
    }
  }, [username, vestsToHpLabel]);

  const loadActivities = useCallback(async (loadMore = false) => {
    if (!username) return;
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      hasMoreRef.current = true;
      lastIndexRef.current = -1;
      setHasMore(true);
      setLastIndex(-1);
    }
    setError(null);

    try {
      const mask = buildOperationFilterMask(localOperationFilter);
      // First page loads a bigger batch (100) when no specific operation
      // filter is set ("All"), so the initial view isn't sparse after
      // client-side filtering. Load-more pages use the normal `limit`.
      const firstPageLimit = localOperationFilter === 'all' ? 100 : limit;
      const historyItems = loadMore
        ? await activityListService.getNextAccountHistoryPage(
            username,
            lastIndexRef.current,
            limit,
            mask?.low,
            mask?.high,
          )
        : await activityListService.getAccountHistory(
            username,
            -1,
            firstPageLimit,
            mask?.low,
            mask?.high,
          );

      const activityItems = activityListService.convertToActivityListItems(historyItems, username);
      activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (loadMore) {
        setActivities(prev => [...prev, ...activityItems]);
      } else {
        setActivities(activityItems);
      }

      if (historyItems.length > 0) {
        const lowestIndex = Math.min(...historyItems.map(item => item.index));
        lastIndexRef.current = lowestIndex;
        setLastIndex(lowestIndex);
      }

      // No more pages when the API returns an empty batch, or when the lowest
      // index reaches the start of the account history (0).
      if (historyItems.length === 0 || lastIndexRef.current <= 0) {
        hasMoreRef.current = false;
        setHasMore(false);
      }
    } catch (err) {
      setError("Failed to load activity history");
      console.error("Error loading activities:", err);
      hasMoreRef.current = false;
      setHasMore(false);
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [username, limit, localOperationFilter]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const loadMoreActivities = useCallback(() => {
    if (hasMoreRef.current && !isLoadingRef.current) {
      loadActivities(true);
    }
  }, [loadActivities]);

  // Infinite scroll: trigger the next page when the sentinel enters the viewport.
  // The scrolling element may be a tab/panel ancestor (not window), so detect
  // the nearest scrollable parent and use it as the observer root. A
  // window-scroll fallback covers the simple "page scrolls" case.
  useEffect(() => {
    const node = loadMoreSentinelRef.current;
    if (!node) return;

    const findScrollableAncestor = (start: HTMLElement | null): HTMLElement | null => {
      let el: HTMLElement | null = start?.parentElement || null;
      while (el && el !== document.body && el !== document.documentElement) {
        const { overflowY } = window.getComputedStyle(el);
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    };

    // Prefer the caller-supplied scroll container (reliable); otherwise
    // fall back to sniffing the nearest scrollable ancestor.
    const root = scrollRootRef?.current ?? findScrollableAncestor(node);
    const observer = new IntersectionObserver(
      entries => {
        const isIntersecting = entries[0]?.isIntersecting ?? false;
        isIntersectingRef.current = isIntersecting;
        if (isIntersecting) {
          loadMoreActivities();
        }
      },
      { root, rootMargin: '300px 0px' },
    );
    observer.observe(node);

    const checkNearBottom = () => {
      const scroller = root ?? document.scrollingElement ?? document.documentElement;
      const scrollTop = root ? (root as HTMLElement).scrollTop : window.scrollY;
      const viewport = root ? (root as HTMLElement).clientHeight : window.innerHeight;
      const total = scroller.scrollHeight;
      if (total - (scrollTop + viewport) < 300) {
        loadMoreActivities();
      }
    };
    const scrollTarget: EventTarget = root ?? window;
    scrollTarget.addEventListener('scroll', checkNearBottom, { passive: true } as AddEventListenerOptions);

    return () => {
      isIntersectingRef.current = false;
      observer.disconnect();
      scrollTarget.removeEventListener('scroll', checkNearBottom);
    };
  }, [loadMoreActivities, hasMore]);

  useEffect(() => {
    let filtered = activities;

    if (localDirectionFilter !== 'all') {
      filtered = filtered.filter(activity => activity.direction === localDirectionFilter);
    }

    if (localOperationFilter !== 'all') {
      filtered = filtered.filter(activity => activity.op === localOperationFilter);
    }

    setFilteredActivities(filtered);
  }, [activities, localDirectionFilter, localOperationFilter]);

  // Trigger more loads if the sentinel is still intersecting (visible on screen) but we are not currently loading.
  // This is essential when client-side filters (like Vote + Out) yield only a few items,
  // leaving the sentinel visible in the viewport without generating a scrollbar.
  useEffect(() => {
    if (isIntersectingRef.current && hasMore && !loading && !loadingMore) {
      loadMoreActivities();
    }
  }, [filteredActivities, hasMore, loading, loadingMore, loadMoreActivities]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getActivityIcon = (activity: ActivityListItem) => {
    switch (activity.type) {
      case 'vote':
      case 'effective_comment_vote':
        return <Wallet className="h-4 w-4" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4" />;
      case 'custom_json':
        return <FileText className="h-4 w-4" />;
      case 'curation_reward':
        return <Wallet className="h-4 w-4" />;
      case 'author_reward':
        return <DollarSign className="h-4 w-4" />;
      case 'comment_benefactor_reward':
        return <User className="h-4 w-4" />;
      case 'transfer':
        return <Send className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getDirectionIcon = (direction: 'in' | 'out') => {
    return direction === 'in' ? (
      <ArrowDown className="h-3 w-3 text-green-500" />
    ) : (
      <ArrowUp className="h-3 w-3 text-blue-500" />
    );
  };

  const toggleExpanded = (activityId: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedActivities(newExpanded);
  };

  const renderDescription = (description: string, activity: ActivityListItem) => {
    const parts = description.split(/(\s+)/);
    return parts.map((part, index) => {
      if (part.includes('/')) {
        const [author, permlink] = part.split('/');
        if (author && permlink) {
          return (
            <span
              key={index}
              className="text-blue-500 cursor-pointer hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                console.log('Clicked permlink:', author, permlink);
                onClickPermlink?.(author, permlink);
              }}
            >
              {part}
            </span>
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  const renderActivityCard = (activity: ActivityListItem) => {
    const activityId = activity.id;
    const isExpanded = expandedActivities.has(activityId);

    return (
      <div
        key={activityId}
        className="bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] rounded-[14px] p-4 transition-[background-color,border-color] duration-150 ease-out hover:bg-[var(--hrk-bg-surface-raised)] hover:border-[var(--hrk-border-default)]"
      >
        <div className="flex items-start gap-3">
          {/* Avatar/Icon */}
          <div className="flex-shrink-0">
            {activity.type === 'vote' && activity.voter ? (
              <img
                src={`https://images.hive.blog/u/${activity.voter}/avatar`}
                alt={activity.voter}
                className="w-10 h-10 rounded-full"
                onError={(e) => {
                  // Fallback to icon if avatar fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={`w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center ${activity.type === 'vote' && activity.voter ? 'hidden' : ''
                }`}
            >
              {getActivityIcon(activity)}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${activity.direction === 'in'
                      ? "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300"
                      : "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"
                    }`}
                >
                  {activity.direction === 'in' ? 'Incoming' : 'Outgoing'}
                </span>
                <span className="text-sm text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)]">
                  {activity.type.replace('_', ' ').toUpperCase()}
                </span>
                {getDirectionIcon(activity.direction)}
              </div>

              {/* Dropdown Menu */}
              <div className="relative" ref={openDropdown === activityId ? dropdownRef : null}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === activityId ? null : activityId)}
                  className="p-2 rounded-lg hover:bg-[var(--hrk-bg-hover)] dark:hover:bg-[var(--hrk-bg-surface-raised)] transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)]" />
                </button>
                {openDropdown === activityId && (
                  <div className="absolute right-0 mt-2 w-48 bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => {
                        toggleExpanded(activityId);
                        setOpenDropdown(null);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-[var(--hrk-text-secondary)] dark:text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-hover)] dark:hover:bg-[var(--hrk-bg-surface-raised)] flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      {isExpanded ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-2">
              <p className="text-[var(--hrk-text-primary)] dark:text-white break-words">
                {activity.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)]">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {activityListService.getRelativeTime(activity.timestamp)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span>Block #{activity.block}</span>
              </div>
              {activity.weight !== undefined && activity.weight !== null && (
                <div className="flex items-center gap-1">
                  <span>{activity.weight.toFixed(2)}%</span>
                </div>
              )}
              {activity.payout && (
                <div className="flex items-center gap-1">
                  <span>💰 {activity.payout}</span>
                </div>
              )}

            </div>

            {isExpanded && (
              <div className="mt-3 p-3 bg-[var(--hrk-bg-app)] rounded-lg">
                <h4 className="text-sm font-medium text-[var(--hrk-text-primary)] dark:text-[var(--hrk-text-primary)] mb-2">Transaction Details</h4>
                <pre className="text-xs text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)] whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(activity.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Navigation Bar with Filters Loading */}
        <div className="bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] rounded-lg p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Search Loading */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 bg-[var(--hrk-bg-hover)] dark:bg-[var(--hrk-bg-surface-raised)] rounded animate-pulse" />
                <div className="w-full h-10 bg-[var(--hrk-bg-hover)] dark:bg-[var(--hrk-bg-surface-raised)] rounded-md animate-pulse" />
              </div>
            </div>

            {/* Filters Loading */}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-24 h-10 bg-[var(--hrk-bg-hover)] dark:bg-[var(--hrk-bg-surface-raised)] rounded-md animate-pulse" />
              ))}
            </div>
          </div>

          {/* Stats Loading */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[var(--hrk-border-subtle)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 bg-[var(--hrk-bg-hover)] dark:bg-[var(--hrk-bg-surface-raised)] rounded animate-pulse w-20" />
            ))}
          </div>
        </div>

        {/* Activity List Loading */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3 px-4 bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 bg-[var(--hrk-bg-hover)] dark:bg-[var(--hrk-bg-surface-raised)] rounded-full animate-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 bg-[var(--hrk-bg-hover)] dark:bg-[var(--hrk-bg-surface-raised)] rounded animate-pulse w-3/4" />
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                <div className="w-3 h-3 bg-[var(--hrk-bg-hover)] dark:bg-[var(--hrk-bg-surface-raised)] rounded animate-pulse" />
                <div className="h-4 bg-[var(--hrk-bg-hover)] dark:bg-[var(--hrk-bg-surface-raised)] rounded animate-pulse w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-[var(--hrk-text-primary)] dark:text-white mb-2">
            Failed to load activities
          </h3>
          <p className="text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)] mb-4">{error}</p>
          <button onClick={() => loadActivities()} className="inline-flex items-center justify-center rounded-md border border-input text-[var(--hrk-text-tertiary)] cursor-pointer bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Three-position direction toggle: left = Outgoing, center = All, right = Incoming.
  // Center is the default — the sliding thumb tracks the active segment.
  const directionIndex = localDirectionFilter === 'out' ? 0 : localDirectionFilter === 'in' ? 2 : 1;
  const thumbColor =
    localDirectionFilter === 'in'
      ? 'bg-green-500 text-white'
      : localDirectionFilter === 'out'
        ? 'bg-blue-500 text-white'
        : 'bg-[var(--hrk-bg-surface-raised)] text-white';

  return (
    <div className="space-y-4">
      {/* Compact filter bar — single row on every breakpoint. Toggle pinned
          to the start, filter + refresh pushed to the end on desktop. */}
      <div className="bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] rounded-lg p-2 sm:p-3">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {/* 3-position direction toggle. Default is centre (All). */}
          <div
            role="radiogroup"
            aria-label="Direction"
            className="relative grid shrink-0 grid-cols-3 rounded-full bg-[var(--hrk-bg-hover)] p-0.5 text-[11px] sm:text-sm dark:bg-[var(--hrk-bg-app)] w-[8.5rem] sm:w-[11rem]"
          >
            <span
              aria-hidden
              className={`absolute top-0.5 bottom-0.5 left-0.5 rounded-full shadow-sm transition-transform duration-200 ease-out ${thumbColor}`}
              style={{ width: 'calc(33.3333% - 0.25rem)', transform: `translateX(${directionIndex * 100}%)` }}
            />
            <button
              type="button"
              role="radio"
              aria-checked={localDirectionFilter === 'out'}
              onClick={() => setLocalDirectionFilter('out')}
              className={`relative z-10 inline-flex items-center justify-center gap-0.5 whitespace-nowrap rounded-full px-1 py-1 sm:gap-1 sm:py-1.5 transition-colors ${
                localDirectionFilter === 'out' ? 'text-white' : 'text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-secondary)]'
              }`}
            >
              <ArrowUp className="h-3 w-3" />
              <span>Out</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={localDirectionFilter === 'all'}
              onClick={() => setLocalDirectionFilter('all')}
              className={`relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-full px-1 py-1 sm:py-1.5 transition-colors ${
                localDirectionFilter === 'all' ? 'text-[var(--hrk-text-primary)] dark:text-white' : 'text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-secondary)]'
              }`}
            >
              <span>All</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={localDirectionFilter === 'in'}
              onClick={() => setLocalDirectionFilter('in')}
              className={`relative z-10 inline-flex items-center justify-center gap-0.5 whitespace-nowrap rounded-full px-1 py-1 sm:gap-1 sm:py-1.5 transition-colors ${
                localDirectionFilter === 'in' ? 'text-white' : 'text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-secondary)]'
              }`}
            >
              <ArrowDown className="h-3 w-3" />
              <span>In</span>
            </button>
          </div>

          {/* End-of-row group: filter dropdown + refresh. Stays right on
              desktop; on mobile takes the remaining space (filter expands,
              refresh stays compact). */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:flex-none sm:gap-2">
            <div className="min-w-0 flex-1 sm:flex-none sm:w-44">
              <OperationFilterDropdown
                value={localOperationFilter}
                onChange={setLocalOperationFilter}
              />
            </div>

            <button
              onClick={() => loadActivities()}
              disabled={loading || loadingMore}
              className="shrink-0 rounded-md border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)] p-1.5 text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--hrk-info)] disabled:cursor-not-allowed disabled:opacity-50 sm:p-2"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading || loadingMore ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Compact stats — single row on mobile too */}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--hrk-border-subtle)] pt-2 text-xs text-[var(--hrk-text-tertiary)]">
          <span>Total: <span className="font-semibold text-[var(--hrk-text-primary)] dark:text-white">{activities.length}</span></span>
          <span>Shown: <span className="font-semibold text-[var(--hrk-text-primary)] dark:text-white">{filteredActivities.length}</span></span>
          <span>In: <span className="font-semibold text-green-600 dark:text-green-400">{activities.filter(a => a.direction === 'in').length}</span></span>
          <span>Out: <span className="font-semibold text-blue-600 dark:text-blue-400">{activities.filter(a => a.direction === 'out').length}</span></span>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-4">
        {filteredActivities.length === 0 && (
          <div className="flex items-center justify-center min-h-[120px]">
            <p className="text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)]">
              {activities.length === 0
                ? "No activities found for this user."
                : hasMore
                  ? "No matches in the loaded batch — fetching more…"
                  : "No activities match the current filters."}
            </p>
          </div>
        )}
        <>
            {filteredActivities.map((activity, index) => (
              <div
                key={`${activity.id}-${index}`}
                className="flex items-center justify-between py-3 px-4 bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] rounded-[12px] transition-[background-color,border-color] duration-150 ease-out hover:bg-[var(--hrk-bg-surface-raised)] hover:border-[var(--hrk-border-default)] cursor-pointer"
                onClick={(e) => {
                  onSelectActivity?.(activity);
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {(() => {
                    // Lead avatar: counterparty for transfer, voter/author for others.
                    const transferCounterparty =
                      activity.type === 'transfer'
                        ? activity.direction === 'in'
                          ? activity.from
                          : activity.to
                        : undefined;
                    const leadAvatarUser =
                      transferCounterparty ||
                      (activity.type === 'vote' ? activity.voter : undefined) ||
                      ((activity.type === 'comment_benefactor_reward' || activity.type === 'comment')
                        ? activity.author
                        : undefined);

                    if (leadAvatarUser) {
                      return (
                        <img
                          src={`https://images.hive.blog/u/${leadAvatarUser}/avatar`}
                          alt={leadAvatarUser}
                          className="w-10 h-10 rounded-full flex-shrink-0 object-cover ring-1 ring-[var(--hrk-border-subtle)]"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      );
                    }
                    return null;
                  })()}
                  <div
                    className={`w-8 h-8 bg-purple-900/20 rounded-full flex items-center justify-center flex-shrink-0 ${
                      (activity.type === 'transfer' && (activity.from || activity.to)) ||
                      (activity.type === 'vote' && activity.voter) ||
                      (activity.type === 'comment_benefactor_reward' && activity.author) ||
                      (activity.type === 'comment' && activity.author)
                        ? 'hidden'
                        : ''
                    }`}
                  >
                    {getActivityIcon(activity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {activity.type === 'transfer' ? (
                      <div>
                        <div className="flex items-center gap-1.5 text-sm">
                          <span
                            className="font-medium text-blue-600 dark:text-blue-400 truncate"
                            title={activity.from}
                          >
                            @{activity.from}
                          </span>
                          <ArrowRight className="h-3 w-3 shrink-0 text-[var(--hrk-text-tertiary)]" />
                          <span
                            className="font-medium text-blue-600 dark:text-blue-400 truncate"
                            title={activity.to}
                          >
                            @{activity.to}
                          </span>
                        </div>
                        {activity.memo && (
                          <p className="mt-1 break-words text-xs italic text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)]">
                            “{activity.memo}”
                          </p>
                        )}
                      </div>
                    ) : activity.type === 'custom_json' || activity.type === 'comment_options' ? (
                      <div>
                        <p className="text-sm text-[var(--hrk-text-primary)] dark:text-white break-words font-medium">
                          {renderDescription(activity.description, activity)}
                        </p>
                        <p className="text-xs text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)]">
                          {activityListService.getRelativeTime(activity.timestamp + 'Z')}
                        </p>
                        <div className="border border-[var(--hrk-border-default)] rounded p-2 bg-[var(--hrk-bg-surface-raised)]/50 mt-1">
                          <div className="text-xs text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)] space-y-1 font-mono break-words">
                            {activity.type === 'custom_json' && (
                              <>
                                <div><span className="font-medium">id:</span> {activity.details.id}</div>
                                <div className="break-all"><span className="font-medium">json:</span> {JSON.stringify(activity.details.json).replace(/\\"/g, '"').replace(/^"|"$/g, '')}</div>
                                <div><span className="font-medium">required_auths:</span> {JSON.stringify(activity.details.required_auths)}</div>
                                <div><span className="font-medium">required_posting_auths:</span> {JSON.stringify(activity.details.required_posting_auths)}</div>
                              </>
                            )}
                            {activity.type === 'comment_options' && (
                              <>
                                <div>
                                  <span className="font-medium">author:</span>
                                  <span
                                    className="text-blue-500 cursor-pointer hover:underline"
                                  >
                                    {activity.details.author}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium">permlink:</span>
                                  <span
                                    className="text-blue-500 cursor-pointer hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      console.log('Clicked permlink:', activity.details.author, activity.details.permlink);
                                      onClickPermlink?.(activity.details.author, activity.details.permlink);
                                    }}
                                  >
                                    {activity.details.permlink}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-[var(--hrk-text-primary)] dark:text-white break-words">
                          {renderDescription(activity.description, activity)}
                        </p>
                        <p className="text-xs text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)] sm:hidden">
                          {activityListService.getRelativeTime(activity.timestamp + 'Z')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {activity.type === 'transfer' ? (
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
                        activity.direction === 'in'
                          ? 'bg-green-900/30 text-green-300'
                          : 'bg-blue-900/30 text-blue-300'
                      }`}
                    >
                      {activity.direction === 'in' ? '+' : '−'} {activity.amount}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)]">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">
                        {activityListService.getRelativeTime(activity.timestamp + 'Z')}
                      </span>
                    </span>
                  </div>
                ) : (() => {
                  // Per-operation value (amount / counterparty / order id
                  // / target post) shown on the right, like the wallet
                  // Transactions view. Falls back to just the timestamp
                  // when an op has no meaningful value.
                  const value = renderActivityValue(activity);
                  if (value) {
                    return (
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4 max-w-[55%]">
                        {value}
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--hrk-text-tertiary)]">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {activityListService.getRelativeTime(activity.timestamp + 'Z')}
                          </span>
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-1 text-sm text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)] flex-shrink-0 ml-4 hidden sm:flex">
                      {activity.type !== 'custom_json' && activity.type !== 'comment_options' && (
                        <>
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {activityListService.getRelativeTime(activity.timestamp + 'Z')}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}

            {hasMore && (
              <div ref={loadMoreSentinelRef} aria-hidden className="h-px w-full" />
            )}

            {hasMore && loadingMore && (
              <div className="flex justify-center py-4 text-sm text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)]">
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading more…
                </span>
              </div>
            )}

            {!hasMore && activities.length > 0 && (
              <div className="text-center text-sm text-[var(--hrk-text-tertiary)] py-4">
                No more activities to load
              </div>
            )}
          </>
      </div>
    </div>
  );
};

export default ActivityList;
