import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { NbCardModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SequenceService } from '../../libs/service/sequence.service';
import { LabelService } from '../../core/label.service';
import { LocaleService } from '../../core/locale.service';
import type { NovelSequence } from '../../libs/model/followup';

@Component({
  selector: 'app-followups',
  templateUrl: './followups.html',
  styleUrl: './followups.scss',
  imports: [CommonModule, TableModule, TagModule, InputTextModule, NbCardModule, IconField, InputIcon, ButtonModule, ToastModule, TranslatePipe],
  providers: [MessageService],
})
export class Followups implements OnInit {
  private sequenceService = inject(SequenceService);
  private messageService  = inject(MessageService);
  private translate       = inject(TranslateService);
  private localeSvc       = inject(LocaleService);
  protected labels        = inject(LabelService).labels;

  sequences = this.sequenceService.sequences;
  loading = this.sequenceService.loading;
  error = this.sequenceService.error;

  actionInProgress = signal<Set<string>>(new Set());

  totalSent    = computed(() => this.sequences().reduce((s, x) => s + x.episodes_sent, 0));
  totalPending = computed(() => this.sequences().reduce((s, x) => s + x.episodes_pending, 0));
  totalFailed  = computed(() => this.sequences().reduce((s, x) => s + x.episodes_failed, 0));
  pendingApproval = computed(() => this.sequences().filter(s => s.approval_status === 'pending_approval'));

  expandedRows: { [key: string]: boolean } = {};

  globalFilterFields = ['email', 'protagonist_name', 'article_title', 'status', 'approval_status', 'user_id'];

  ngOnInit(): void {
    this.sequenceService.load();
  }

  async approve(seq: NovelSequence): Promise<void> {
    if (this.isActionInProgress(seq.user_id)) return;
    this.setActionInProgress(seq.user_id, true);
    try {
      await this.sequenceService.approve(seq.user_id);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('followups.toast.approved'),
        detail: this.translate.instant('followups.toast.approvedDetail', { name: seq.protagonist_name ?? seq.email }),
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('followups.toast.errorTitle'),
        detail: this.translate.instant('followups.toast.approveFailed'),
      });
    } finally {
      this.setActionInProgress(seq.user_id, false);
    }
  }

  async reject(seq: NovelSequence): Promise<void> {
    if (this.isActionInProgress(seq.user_id)) return;
    this.setActionInProgress(seq.user_id, true);
    try {
      await this.sequenceService.reject(seq.user_id);
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('followups.toast.rejected'),
        detail: this.translate.instant('followups.toast.rejectedDetail', { name: seq.protagonist_name ?? seq.email }),
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('followups.toast.errorTitle'),
        detail: this.translate.instant('followups.toast.rejectFailed'),
      });
    } finally {
      this.setActionInProgress(seq.user_id, false);
    }
  }

  isActionInProgress(userId: string): boolean {
    return this.actionInProgress().has(userId);
  }

  private setActionInProgress(userId: string, inProgress: boolean): void {
    this.actionInProgress.update(s => {
      const next = new Set(s);
      if (inProgress) next.add(userId); else next.delete(userId);
      return next;
    });
  }

  getSeqSeverity(status?: string | null): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | null | undefined {
    switch ((status ?? '').toLowerCase()) {
      case 'complete': return 'success';
      case 'active': return 'info';
      case 'scheduling': return 'warn';
      case 'generated': return 'secondary';
      default: return 'secondary';
    }
  }

  getApprovalSeverity(status?: string | null): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | null | undefined {
    switch ((status ?? '').toLowerCase()) {
      case 'approved': return 'success';
      case 'auto_approved': return 'success';
      case 'pending_approval': return 'warn';
      case 'rejected': return 'danger';
      default: return 'secondary';
    }
  }

  getApprovalLabel(status?: string | null): string {
    switch ((status ?? '').toLowerCase()) {
      case 'approved': return this.translate.instant('followups.approval.approved');
      case 'auto_approved': return this.translate.instant('followups.approval.autoApproved');
      case 'pending_approval': return this.translate.instant('followups.approval.pending');
      case 'rejected': return this.translate.instant('followups.approval.rejected');
      default: return status ?? '—';
    }
  }

  getEpSeverity(status?: string | null): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | null | undefined {
    switch ((status ?? '').toLowerCase()) {
      case 'sent': return 'success';
      case 'failed': return 'danger';
      case 'cancelled': return 'secondary';
      case 'pending': return 'warn';
      default: return 'secondary';
    }
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    return this.localeSvc.formatDate(iso, { dateStyle: 'short', timeStyle: 'short' });
  }

  formatScheduled(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const daysDiff = Math.round(diff / (1000 * 60 * 60 * 24));
    const dateStr = this.localeSvc.formatDate(d, { dateStyle: 'short', timeStyle: 'short' });
    if (daysDiff > 0) return this.translate.instant('followups.scheduledIn', { date: dateStr, days: daysDiff });
    if (daysDiff === 0) return this.translate.instant('followups.scheduledToday', { date: dateStr });
    return dateStr;
  }

  episodeLabel(ep: string): string {
    const n = parseInt(ep, 10);
    return isNaN(n) ? ep : this.translate.instant('followups.epShort', { n });
  }

  ctaLabel(cta?: string | null): string {
    if (!cta) return '—';
    return cta.replace(/_/g, ' ');
  }

  styleLabel(style?: string | null): string {
    if (!style) return '—';
    const name = style.split('_')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  progressSeverity(seq: NovelSequence): 'success' | 'warn' | 'danger' | 'info' {
    if (seq.episodes_failed > 0) return 'danger';
    if (seq.episodes_sent === seq.episodes.length) return 'success';
    if (seq.episodes_sent > 0) return 'info';
    return 'warn';
  }
}
