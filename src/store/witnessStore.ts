import { create } from 'zustand';
import { Witness, WitnessFilters, WitnessVote, Account } from '../types/witness';
import { witnessService } from '../services/witnessService';

interface WitnessState {
  witnesses: Witness[];
  witnessVotes: WitnessVote[];
  userWitnessVotes: string[];
  witnessDetails: Map<string, string>;
  witnessAccounts: Map<string, Account>;
  loadingWitnesses: boolean;
  loadingMoreWitnesses: boolean; // 🆕 added
  loadingVotes: boolean;
  loadingMoreVotes: boolean;
  loadingUserVotes: boolean;
  error: string | null;
  nextWitnessStart: string;
  nextVotesStart: string;
  hasMoreWitnesses: boolean;
  hasMoreVotes: boolean;
  selectedWitness: string | null;
  filters: WitnessFilters;

  loadWitnesses: (start?: string, limit?: number) => Promise<void>;
  loadMoreWitnesses: () => Promise<void>;
  loadWitnessVotes: (witness: string) => Promise<void>;
  loadMoreVotes: () => Promise<void>;
  loadUserWitnessVotes: (username?: string) => Promise<void>;
  loadWitnessDetails: (owners: string[]) => Promise<void>;
  setFilters: (filters: WitnessFilters) => void;
  setSelectedWitness: (witness: string | null) => void;
  clearVotes: () => void;
}

export const useWitnessStore = create<WitnessState>((set, get) => ({
  witnesses: [],
  witnessVotes: [],
  userWitnessVotes: [],
  witnessDetails: new Map(),
  witnessAccounts: new Map(),
  loadingWitnesses: false,
  loadingMoreWitnesses: false, // 🆕 added
  loadingVotes: false,
  loadingMoreVotes: false,
  loadingUserVotes: false,
  error: null,
  nextWitnessStart: '',
  nextVotesStart: '',
  hasMoreWitnesses: true,
  hasMoreVotes: false,
  selectedWitness: null,
  filters: { status: 'all', name: '', version: '' },

  // 🧠 Load witnesses (first or paginated load)
  loadWitnesses: async (start = '', limit = 50) => {
    const { witnesses } = get();

    if (witnesses.length >= 500) {
      set({ hasMoreWitnesses: false });
      return;
    }

    const isLoadMore = start !== '';
    if (isLoadMore) set({ loadingMoreWitnesses: true }); // 🆕 handle loadMore state
    else set({ loadingWitnesses: true, error: null });

    try {
      const data = await witnessService.getWitnessesByVote(start, limit);

      set((state) => {
        const existingOwners = new Set(state.witnesses.map((w) => w.owner));
        const newWitnesses = data.filter((w) => !existingOwners.has(w.owner));

        return {
          witnesses: [...state.witnesses, ...newWitnesses],
          nextWitnessStart: data.length > 0 ? data[data.length - 1].owner : '',
          hasMoreWitnesses: data.length === limit,
        };
      });

      // Load details for new witnesses only
      const newOwners = data
        .filter((w) => !get().witnessDetails.has(w.owner))
        .map((w) => w.owner);

      if (newOwners.length > 0) {
        get().loadWitnessDetails(newOwners);
      }
    } catch (err) {
      console.error('Error loading witnesses:', err);
      set({ error: 'Failed to load witnesses data' });
    } finally {
      set({ loadingWitnesses: false, loadingMoreWitnesses: false }); // 🆕 reset both
    }
  },

  // ⚙️ Infinite scroll loader
  loadMoreWitnesses: async () => {
    const { nextWitnessStart, hasMoreWitnesses, loadingMoreWitnesses } = get();
    if (!hasMoreWitnesses || loadingMoreWitnesses || !nextWitnessStart) return;
    await get().loadWitnesses(nextWitnessStart, 50);
  },

  loadWitnessVotes: async (witness: string) => {
    set({
      loadingVotes: true,
      witnessVotes: [],
      nextVotesStart: '',
      hasMoreVotes: false,
      selectedWitness: witness,
    });

    try {
      const response = await witnessService.getWitnessVotes(witness, '', 250);
      set({
        witnessVotes: response.votes,
        nextVotesStart:
          response.votes.length > 0
            ? response.votes[response.votes.length - 1].account
            : '',
        hasMoreVotes: response.votes.length === 250,
        loadingVotes: false,
      });
    } catch (err) {
      console.error('Error loading witness votes:', err);
      set({ error: 'Failed to load witness votes', loadingVotes: false });
    }
  },

  loadMoreVotes: async () => {
    const {
      hasMoreVotes,
      loadingMoreVotes,
      nextVotesStart,
      selectedWitness,
      witnessVotes,
    } = get();

    if (
      !hasMoreVotes ||
      loadingMoreVotes ||
      !nextVotesStart ||
      witnessVotes.length >= 1000
    ) {
      if (witnessVotes.length >= 1000) set({ hasMoreVotes: false });
      return;
    }

    set({ loadingMoreVotes: true });
    try {
      const response = await witnessService.getWitnessVotes(
        selectedWitness || '',
        nextVotesStart,
        250
      );

      set((state) => {
        const combined = [...state.witnessVotes, ...response.votes];
        const uniqueVotes = combined.filter(
          (vote, index, self) =>
            self.findIndex((v) => v.account === vote.account) === index
        );
        const uniqueResponseVotes = response.votes.filter(
          (vote, index, self) =>
            self.findIndex((v) => v.account === vote.account) === index
        );
        return {
          witnessVotes: uniqueVotes,
          nextVotesStart:
            uniqueResponseVotes.length > 0
              ? uniqueResponseVotes[uniqueResponseVotes.length - 1].account
              : '',
          hasMoreVotes: response.votes.length === 250,
        };
      });
    } catch (err) {
      console.error('Error loading more witness votes:', err);
    } finally {
      set({ loadingMoreVotes: false });
    }
  },

  loadUserWitnessVotes: async (username?: string) => {
    if (!username) return;
    set({ loadingUserVotes: true });
    try {
      const votes = await witnessService.getUserWitnessVotes(username);
      set({ userWitnessVotes: votes });
    } catch (err) {
      console.error('Error loading user witness votes:', err);
    } finally {
      set({ loadingUserVotes: false });
    }
  },

  loadWitnessDetails: async (owners: string[]) => {
    try {
      const accounts = await witnessService.getAccounts(owners);
      set((state) => {
        const updatedDetails = new Map(state.witnessDetails);
        const updatedAccounts = new Map(state.witnessAccounts);
        accounts.forEach((account) => {
          const description = witnessService.getWitnessDescription(account);
          if (description) updatedDetails.set(account.name, description);
          updatedAccounts.set(account.name, account);
        });
        return { witnessDetails: updatedDetails, witnessAccounts: updatedAccounts };
      });
    } catch (err) {
      console.error('Error loading witness details:', err);
    }
  },

  setFilters: (filters) => set({ filters }),
  setSelectedWitness: (witness) => set({ selectedWitness: witness }),
  clearVotes: () =>
    set({
      witnessVotes: [],
      nextVotesStart: '',
      hasMoreVotes: false,
      selectedWitness: null,
    }),
}));
