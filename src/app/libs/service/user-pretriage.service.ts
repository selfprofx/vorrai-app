/**
 * Service for the patient anamnesis (pre-triage) surface.
 *
 * Backed by:
 *   GET  /dashboard/users/:user_id/pretriage          — fetch latest row
 *   POST /dashboard/users/:user_id/pretriage/review   — mark reviewed
 *   POST /dashboard/users/:user_id/pretriage/notes    — save doctor_notes
 *
 * The pre-triage row is the patient's self-report. The AI never classifies
 * red flags — the doctor decides. `summary_json` is shaped to mirror the
 * `PreTriageSummaryInput` schema on the agent side; the editor renders
 * its sections defensively so future field additions don't break rendering.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PreTriageStatus =
  | 'pending'
  | 'complete'
  | 'reviewed'
  | 'requires_human';

/** Verbatim consent snapshot — every field the patient saw at consent time.
 *  Open shape so we faithfully render whatever the agent stamped. */
export type ConsentSnapshot = Record<string, unknown>;

/** Structured patient self-report. Open Record so additional fields the
 *  triage_summary_generator_agent emits in future versions still render. */
export type PreTriageSummary = Record<string, unknown>;

export interface PreTriageRecord {
  appointment_id: string | null;
  status: PreTriageStatus;
  consent_snapshot: ConsentSnapshot | null;
  summary: PreTriageSummary | null;
  red_flags_self_reported: string[];
  ai_model_used: string | null;
  ai_model_version: string | null;
  doctor_notes: string | null;
  created_at: string;
  completed_at: string | null;
  reviewed_at: string | null;
}

export interface PreTriageResponse {
  user_id: string;
  pretriage: PreTriageRecord | null;
}

@Injectable({ providedIn: 'root' })
export class UserPretriageService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  get(userId: string): Promise<PreTriageResponse> {
    return firstValueFrom(this.http.get<PreTriageResponse>(
      `${this.base}/dashboard/users/${encodeURIComponent(userId)}/pretriage`,
    ));
  }

  /** Flip status to "reviewed" + stamp reviewed_at. Idempotent.
   *  `created_at` identifies the specific row (SK on UserPreTriageDAO). */
  markReviewed(userId: string, createdAt: string): Promise<{ status: PreTriageStatus; reviewed_at: string }> {
    return firstValueFrom(this.http.post<{ status: PreTriageStatus; reviewed_at: string }>(
      `${this.base}/dashboard/users/${encodeURIComponent(userId)}/pretriage/review`,
      { created_at: createdAt },
    ));
  }

  /** Overwrite doctor_notes on the row. The dashboard is the source of truth
   *  for notes — the AI never writes to this field. */
  saveNotes(userId: string, createdAt: string, notes: string): Promise<{ doctor_notes: string }> {
    return firstValueFrom(this.http.post<{ doctor_notes: string }>(
      `${this.base}/dashboard/users/${encodeURIComponent(userId)}/pretriage/notes`,
      { created_at: createdAt, notes },
    ));
  }
}
