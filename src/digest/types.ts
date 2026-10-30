export type LogLine = {
  at: string;
  job: string;
  status: 'ok' | 'retry' | 'fail';
  owner: string | null;
  error?: string;
};

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: 'ok' | 'retry' | 'fail';
  lastError: string | null;
  firstAt: string;
  lastAt: string;
  badLines: number;
};
