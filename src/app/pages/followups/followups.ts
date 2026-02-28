import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { NbCardModule } from '@nebular/theme';
import { SequenceService } from '../../libs/service/sequence.service';
import type { NovelSequence } from '../../libs/model/followup';

@Component({
  selector: 'app-followups',
  templateUrl: './followups.html',
  styleUrl: './followups.scss',
  imports: [CommonModule, TableModule, TagModule, InputTextModule, NbCardModule, IconField, InputIcon],
})
export class Followups implements OnInit {
  private sequenceService = inject(SequenceService);

  sequences = this.sequenceService.sequences;
  loading = this.sequenceService.loading;
  error = this.sequenceService.error;

  totalSent    = computed(() => this.sequences().reduce((s, x) => s + x.episodes_sent, 0));
  totalPending = computed(() => this.sequences().reduce((s, x) => s + x.episodes_pending, 0));
  totalFailed  = computed(() => this.sequences().reduce((s, x) => s + x.episodes_failed, 0));

  expandedRows: { [key: string]: boolean } = {};

  globalFilterFields = ['email', 'protagonist_name', 'article_title', 'status', 'user_id'];

  ngOnInit(): void {
    this.sequenceService.load();
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

  getEpSeverity(status?: string | null): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | null | undefined {
    switch ((status ?? '').toLowerCase()) {
      case 'sent': return 'success';
      case 'failed': return 'danger';
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
    // "brunson_epiphany_bridge" → "Brunson"
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
