/**
 * Label dictionary keys. Add new keys here and add the corresponding
 * string to BOTH `default.ts` and `clinical.ts` so the dictionaries
 * stay in lock-step.
 */
export interface LabelDictionary {
  // Top-level menu group headers
  groupHome: string;
  groupContent: string;
  groupManagement: string;
  groupManager: string;

  // Main nav items
  dashboard: string;
  bookings: string;
  leads: string;
  chats: string;

  // Content nav items
  followups: string;
  templates: string;
  contents: string;
  contentJobs: string;
  blog: string;
  subscribers: string;

  // Management nav items
  products: string;
  personas: string;
  offers: string;
  courses: string;
  council: string;
  councilHistory: string;
  optimization: string;

  // Page-level labels
  leadsTitle: string;
  leadsSubtitle: string;
  leadSingular: string;
  prospectSingular: string;

  chatsTitle: string;
  chatsSubtitle: string;
  receptionistAiName: string;

  bookingsTitle: string;
  bookingsSubtitle: string;

  followupsTitle: string;
  followupsSubtitle: string;
  episodeSingular: string;

  contentsTitle: string;
  contentsSubtitle: string;

  contentJobsTitle: string;
  contentJobsSubtitle: string;

  // Settings tab + AI Limits section
  aiLimitsTitle: string;
  webChatLimitLabel: string;
  agentLimitLabel: string;

  // Manager column header
  managerLeadsColumn: string;
}

export type LabelKey = keyof LabelDictionary;
export type TenantVertical = 'marketing' | 'clinical';
