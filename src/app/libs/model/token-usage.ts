export interface TokenUsageRecord {
  created_at: string;
  model?: string | null;
  source?: string | null;
  flow_step?: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

export interface TokenUsageTotals {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

export interface TokenUsageResponse {
  items: TokenUsageRecord[];
  count: number;
  totals: TokenUsageTotals;
}
