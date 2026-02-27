export interface Product {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price?: string | null;
  currency?: string | null;
  transformation?: string | null;
  pain_points?: string | null;
  utm_campaign?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Persona {
  id: string;
  product_id?: string | null;
  name: string;
  description?: string | null;
  pain_points?: string | null;
  demographics?: string | null;
  desires?: string | null;
  utm_persona?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TenantOffer {
  id: string;
  product_id?: string | null;
  persona_id?: string | null;
  name: string;
  headline?: string | null;
  subheadline?: string | null;
  description?: string | null;
  guarantee?: string | null;
  price_usd?: string | null;
  stack_items?: string[];
  utm_content?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AiRecommendation {
  flagged: boolean;
  flag_reason?: string;
  suggestion: Record<string, any> | null;
}
