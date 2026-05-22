/**
 * Vorrai plan tiers — the single source of truth for the dashboard "Plans"
 * section and the Settings → Plans & Billing tab. Kept in sync with the
 * pricing section on vorrai.co.
 *
 * `num` matches the `module_num` on a tenant's `active_plans` entries, so a
 * tier is "active" when the tenant has an active plan with the same number.
 */
export interface PlanTier {
  num: string;
  name: string;
  subtitle: string;
  description: string;
  color: string;
  features: string[];
  recommended?: boolean;
}

export const PLAN_TIERS: PlanTier[] = [
  {
    num: '01',
    name: 'Vorrai Starter',
    subtitle: 'For independent specialists',
    description: 'The 24/7 WhatsApp AI receptionist for a single-doctor practice — booking, reminders, and no-show recovery, with the managed-operations team behind it.',
    color: '#004B3C',
    features: [
      '24/7 WhatsApp receptionist',
      'Booking, reminders & no-show waitlist',
      'Up to 2 calendars / rooms',
      'Payments & insurance verification',
    ],
  },
  {
    num: '02',
    name: 'Vorrai Practice',
    subtitle: 'For clinics building their patient base',
    description: 'Everything in Starter, plus the Content Engine, post-consult review collection, and a hosted SEO presence for a growing clinic.',
    color: '#004B3C',
    recommended: true,
    features: [
      'Content Engine — compliant, doctor-approved posts',
      'Post-consult review collection',
      'Hosted SEO page + Google Business sync',
      'Up to 8 calendars + advanced analytics',
    ],
  },
  {
    num: '03',
    name: 'Vorrai Enterprise',
    subtitle: 'For groups and franchises',
    description: 'Everything in Practice, plus custom integrations, a shared floating waitlist across clinics, cross-clinic benchmarking, and a dedicated ops manager.',
    color: '#004B3C',
    features: [
      'Custom API & EHR integrations',
      'Shared floating waitlist across clinics',
      'Cross-clinic benchmark dashboard',
      'Dedicated ops manager, SLA & whitelabel',
    ],
  },
];
