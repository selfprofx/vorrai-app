/**
 * Share-links dashboard page — vorrai-app/dashboard/share-links.
 *
 * The doctor opens this page right after onboarding completes to grab the
 * wa.me URLs they'll paste into Instagram bio / WhatsApp Business About /
 * Google Business Profile / front-desk QR-code prints. Both doctor and
 * receptionist roles can read this surface (the wa.me links are
 * patient-facing assets, not write actions — handled at the backend by
 * `/dashboard/clinic/share-links` having no `_require_doctor` guard).
 *
 * Each row exposes two copy-buttons:
 *   - "Copy share text" — the friendly prefix sentence the patient sees
 *     in their WhatsApp input (`Hi! I'd like to book at <clinic>…
 *     Vorrai:book:clinic=…`). Useful for SMS / pasting elsewhere.
 *   - "Copy link" — the wa.me URL itself. Opens WhatsApp directly when
 *     the patient taps it.
 *
 * QR-code rendering is a deliberate follow-up — once a QR lib is added
 * to vorrai-app, the same response payload renders printable PDFs per
 * doctor + per location.
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NbCardModule, NbButtonModule, NbIconModule, NbBadgeModule,
  NbSpinnerModule, NbToastrService,
} from '@nebular/theme';
import {
  ClinicShareLinksService,
  ShareLinksResponse,
} from '../../libs/service/clinic-share-links.service';

@Component({
  selector: 'share-links',
  templateUrl: './share-links.html',
  styleUrl: './share-links.scss',
  imports: [
    CommonModule,
    NbCardModule, NbButtonModule, NbIconModule, NbBadgeModule, NbSpinnerModule,
  ],
})
export class ShareLinks implements OnInit {
  private service = inject(ClinicShareLinksService);
  private toastr  = inject(NbToastrService);

  links   = signal<ShareLinksResponse | null>(null);
  loading = signal(true);
  error   = signal<string | null>(null);

  async ngOnInit() {
    try {
      this.links.set(await this.service.list());
    } catch (e: any) {
      this.error.set(e?.error?.Message || e?.message || 'Failed to load share-links');
    } finally {
      this.loading.set(false);
    }
  }

  async copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      this.toastr.success(`${label} copied`, 'Copied', { duration: 2000 });
    } catch {
      this.toastr.warning('Could not copy automatically — long-press the value to copy.', 'Copy failed');
    }
  }

  /** Quick wa.me link tester — open in a new tab. */
  open(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
