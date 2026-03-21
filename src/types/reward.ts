export interface PendingAuthorRow {
  author: string;
  permlink: string;
  title: string;
  isComment: boolean;
  payoutMs: number;
  hbd: number;
  hpEq: number | null;
  beneficiaryCut: number;
}

export interface PendingCurationRow {
  hp: number;
  hbd: number;
  author: string;
  permlink: string;
  title: string;
  payoutMs: number;
  votedAfterMs: number | null;
  weightPct: number;
  efficiency: number | null;
  isComment: boolean;
}
