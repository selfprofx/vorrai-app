/**
 * Anamnesis viewer — vorrai-app/users/:userId/anamnesis.
 *
 * Surfaces the patient's pre-triage record to the doctor BEFORE the consult.
 * This is patient self-report only — the AI never classifies red flags;
 * the doctor decides. The viewer's three responsibilities:
 *
 *   1. Render the verbatim `consent_snapshot` so the doctor sees exactly
 *      which consents the patient gave + when + which text version (legal
 *      record). The consent panel is the first thing on the page.
 *
 *   2. Render the structured `summary_json` — defensively, since the
 *      agent's schema can grow. Recognised top-level keys get pretty
 *      sections; anything else falls through to a "Other reported"
 *      section that renders the raw key/value pairs.
 *
 *   3. Capture `doctor_notes` separately from the AI summary. This is
 *      the human's record; we never co-mingle it with the patient's
 *      self-report.
 *
 * On open, the page auto-flips status to "reviewed" so the dashboard's
 * "needs review" counter drops. The pretriage_status field on the
 * CalendarEvent row is the operational view the appointments page reads
 * from — independent of this viewer.
 */
import {
  Component, OnInit, inject, signal, computed,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
  NbBadgeModule, NbSpinnerModule, NbToastrService,
} from '@nebular/theme';
import {
  UserPretriageService, PreTriageRecord, PreTriageStatus,
} from '../../libs/service/user-pretriage.service';

/** Top-level keys the summary_generator currently emits — recognised here
 *  so they render under nicely-labelled sections. Anything else falls
 *  through to the generic "Other reported" section. */
const KNOWN_SUMMARY_SECTIONS: Array<{ key: string; label: string }> = [
  { key: 'chief_complaint',         label: 'Chief complaint' },
  { key: 'onset',                   label: 'Onset' },
  { key: 'symptom_evolution',       label: 'Symptom evolution' },
  { key: 'current_medications',     label: 'Current medications' },
  { key: 'allergies',               label: 'Allergies' },
  { key: 'medical_history',         label: 'Medical history' },
  { key: 'family_history',          label: 'Family history' },
  { key: 'lifestyle',               label: 'Lifestyle' },
  { key: 'insurance',               label: 'Insurance' },
  { key: 'preferred_language',      label: 'Preferred language' },
];

const STATUS_LABEL: Record<PreTriageStatus, string> = {
  pending: 'In progress',
  complete: 'Awaiting review',
  reviewed: 'Reviewed',
  requires_human: 'Requires human follow-up',
};
const STATUS_BADGE: Record<PreTriageStatus, 'primary' | 'warning' | 'success' | 'danger'> = {
  pending: 'primary',
  complete: 'warning',
  reviewed: 'success',
  requires_human: 'danger',
};

@Component({
  selector: 'anamnesis',
  templateUrl: './anamnesis.html',
  styleUrl: './anamnesis.scss',
  imports: [
    CommonModule, FormsModule, DatePipe, RouterLink,
    NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
    NbBadgeModule, NbSpinnerModule,
  ],
})
export class Anamnesis implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private service = inject(UserPretriageService);
  private toastr  = inject(NbToastrService);

  loading = signal(true);
  error   = signal<string | null>(null);

  userId  = signal<string>('');
  record  = signal<PreTriageRecord | null>(null);
  doctorNotes = signal('');
  savingNotes = signal(false);

  readonly statusLabel = computed(() => {
    const r = this.record();
    return r ? STATUS_LABEL[r.status] || r.status : '';
  });
  readonly statusBadge = computed(() => {
    const r = this.record();
    return r ? STATUS_BADGE[r.status] || 'primary' : 'primary';
  });

  /** Pretty consent flag entries — preserves the verbatim keys + values. */
  readonly consentEntries = computed(() => {
    const r = this.record();
    if (!r?.consent_snapshot) return [];
    return Object.entries(r.consent_snapshot).map(([k, v]) => ({
      label: this.prettifyKey(k),
      raw_key: k,
      value: v,
    }));
  });

  /** Known structured sections from summary_json, preserving order. */
  readonly knownSections = computed(() => {
    const r = this.record();
    if (!r?.summary) return [];
    const out: Array<{ key: string; label: string; value: unknown }> = [];
    for (const { key, label } of KNOWN_SUMMARY_SECTIONS) {
      const v = (r.summary as Record<string, unknown>)[key];
      if (v === null || v === undefined || v === '' ||
          (Array.isArray(v) && v.length === 0)) continue;
      out.push({ key, label, value: v });
    }
    return out;
  });

  /** Anything in summary_json the schema doesn't yet know about — defensive
   *  rendering so a forward-compatible agent update never blanks the page. */
  readonly extraEntries = computed(() => {
    const r = this.record();
    if (!r?.summary) return [];
    const known = new Set(KNOWN_SUMMARY_SECTIONS.map(s => s.key));
    return Object.entries(r.summary as Record<string, unknown>)
      .filter(([k, v]) =>
        !known.has(k) &&
        v !== null && v !== undefined && v !== '' &&
        !(Array.isArray(v) && v.length === 0),
      )
      .map(([k, v]) => ({ label: this.prettifyKey(k), value: v }));
  });

  async ngOnInit() {
    const uid = this.route.snapshot.paramMap.get('userId');
    if (!uid) {
      this.error.set('Missing user id in URL');
      this.loading.set(false);
      return;
    }
    this.userId.set(uid);

    try {
      const res = await this.service.get(uid);
      this.record.set(res.pretriage);
      this.doctorNotes.set(res.pretriage?.doctor_notes ?? '');

      // Auto-mark reviewed on open. Patient pretriage rows go from
      // "complete" → "reviewed" the moment a doctor lands here. Idempotent
      // — repeated opens are no-ops.
      if (res.pretriage && res.pretriage.status === 'complete') {
        try {
          await this.service.markReviewed(uid, res.pretriage.created_at);
          // Reflect locally without re-fetching.
          this.record.update(r => r ? { ...r, status: 'reviewed' } : r);
        } catch {
          // Non-fatal — the page still renders.
        }
      }
    } catch (e: any) {
      this.error.set(e?.error?.Message || e?.message || 'Failed to load anamnesis');
    } finally {
      this.loading.set(false);
    }
  }

  async saveNotes() {
    const r = this.record();
    if (!r) return;
    this.savingNotes.set(true);
    try {
      await this.service.saveNotes(this.userId(), r.created_at, this.doctorNotes());
      this.toastr.success('Notes saved', 'Saved', { duration: 2000 });
    } catch (e: any) {
      this.toastr.danger(e?.error?.Message || e?.message || 'Failed to save notes', 'Error');
    } finally {
      this.savingNotes.set(false);
    }
  }

  /** Render any structured value (string, array, object) as a display-safe form. */
  renderValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      return value.map(v => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ');
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  /** snake_case → Title Case for verbatim consent + extra summary keys. */
  prettifyKey(k: string): string {
    return k
      .replace(/[_\-]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\bAi\b/g, 'AI')
      .replace(/\bLgpd\b/g, 'LGPD')
      .replace(/\bGdpr\b/g, 'GDPR')
      .replace(/\bHipaa\b/g, 'HIPAA');
  }
}
