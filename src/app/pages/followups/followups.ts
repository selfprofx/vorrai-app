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
import { SequenceService } from '../../libs/service/sequence.service';
import type { NovelSequence } from '../../libs/model/followup';

@Component({
  selector: 'app-followups',
  templateUrl: './followups.html',
  styleUrl: './followups.scss',
  imports: [CommonModule, TableModule, TagModule, InputTextModule, NbCardModule, IconField, InputIcon, ButtonModule, ToastModule],
  providers: [MessageService],
})
export class Followups implements OnInit {
  private sequenceService = inject(SequenceService);
  private messageService = inject(MessageService);

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
      this.messageService.add({ severity: 'success', summary: 'Approved', detail: `Sequence for ${seq.protagonist_name ?? seq.email} approved. Day 0 email will be sent shortly.` });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to approve sequence. Please try again.' });
    } finally {
      this.setActionInProgress(seq.user_id, false);
    }
  }

  async reject(seq: NovelSequence): Promise<void> {
    if (this.isActionInProgress(seq.user_id)) return;
    this.setActionInProgress(seq.user_id, true);
    try {
      await this.sequenceService.reject(seq.user_id);
      this.messageService.add({ severity: 'info', summary: 'Rejected', detail: `Sequence for ${seq.protagonist_name ?? seq.email} rejected. Booking email will be sent shortly.` });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to reject sequence. Please try again.' });
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
      case 'approved': return 'Approved';
      case 'auto_approved': return 'Auto-Approved';
      case 'pending_approval': return 'Pending Approval';
      case 'rejected': return 'Rejected';
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
    return new Date(iso).toLocaleString();
  }

  formatScheduled(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const daysDiff = Math.round(diff / (1000 * 60 * 60 * 24));
    const dateStr = d.toLocaleString();
    if (daysDiff > 0) return `${dateStr} (in ${daysDiff}d)`;
    if (daysDiff === 0) return `${dateStr} (today)`;
    return dateStr;
  }

  episodeLabel(ep: string): string {
    const n = parseInt(ep, 10);
    return isNaN(n) ? ep : `Ep ${n}`;
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
