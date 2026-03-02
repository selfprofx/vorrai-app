export interface DesignTokens {
  bg_color: string;
  card_bg_color: string;
  header_bg_color?: string;
  border_color: string;
  text_color: string;
  accent_color: string;
  cta_text_color: string;
  secondary_text_color: string;
  footer_bg_color: string;
  font_headline: string;
  font_body: string;
}

export interface EmailTemplateSummary {
  template_type: string;
  subject_template: string | null;
  design_tokens: DesignTokens | null;
  version: number;
  updated_at: string | null;
  created_by: string | null;
  has_html: boolean;
}

export interface EmailTemplateDetail extends EmailTemplateSummary {
  html_template: string | null;
  text_template: string | null;
}
