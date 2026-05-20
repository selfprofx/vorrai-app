import type { LabelDictionary } from './types';

/**
 * Clinical vocabulary — used by tenants with vertical === 'clinical'
 * (medical clinics deploying the Vorrai AI Receptionist).
 */
export const CLINICAL_LABELS: LabelDictionary = {
  // Menu groups
  groupHome:       'Clinic',
  groupContent:    'Clinic Content',
  groupManagement: 'Practice',
  groupManager:    'Network',

  // Main nav
  dashboard: 'Dashboard',
  bookings:  'Appointments',
  leads:     'Patients',
  chats:     'Patient Conversations',

  // Content nav
  followups:    'Patient Recalls',
  templates:    'Message Templates',
  contents:     'Clinic Posts',
  contentJobs:  'Post Jobs',
  blog:         'Clinic Blog',
  subscribers:  'Newsletter',

  // Management nav (some marketing-only items hidden via menu builder)
  products:        'Services',
  personas:        'Patient Personas',
  offers:          'Treatment Packages',
  courses:         'Patient Education',
  council:         'Clinical Council',
  councilHistory:  'Council History',
  optimization:    'Clinic Optimisation',

  // Pages
  leadsTitle:        'Patients',
  leadsSubtitle:     'Patients captured via landing page, WhatsApp, SMS, and Web chat',
  leadSingular:      'Patient',
  prospectSingular:  'Patient',

  chatsTitle:          'Patient Conversations',
  chatsSubtitle:       'Active receptionist sessions with your patients',
  receptionistAiName:  'Vorrai Receptionist',

  bookingsTitle:    'Appointments',
  bookingsSubtitle: 'Manage appointments and calendar connections',

  followupsTitle:    'Patient Recalls',
  followupsSubtitle: 'Recall messages generated for patients after their consultation',
  episodeSingular:   'Reminder',

  contentsTitle:     'Clinic Posts',
  contentsSubtitle:  'Compliant clinical content created by the AI for your channels',

  contentJobsTitle:    'Clinic Post Jobs',
  contentJobsSubtitle: 'Background jobs producing your compliant clinical content',

  // Settings
  aiLimitsTitle:      'Receptionist Limits',
  webChatLimitLabel:  'Patient Chat Max Characters',
  agentLimitLabel:    'Doctor-Side Agent Max Characters',

  // Manager
  managerLeadsColumn: 'Patients',
};
