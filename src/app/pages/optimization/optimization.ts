import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { NbCardModule, NbSpinnerModule, NbToggleModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { OptimizationService } from '../../libs/service/optimization.service';
import { LocaleService } from '../../core/locale.service';
import type { OptimizationRecord } from '../../libs/model/optimization';

@Component({
  selector: 'app-optimization',
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    TableModule, Tag, ButtonModule, SelectModule, DialogModule, TextareaModule,
    NbCardModule, NbSpinnerModule, NbToggleModule,
  ],
  templateUrl: './optimization.html',
})
export class Optimization implements OnInit {
  private optService = inject(OptimizationService);
  private translate  = inject(TranslateService);
  private locale     = inject(LocaleService);

  records = this.optService.records;
  loading = this.optService.loading;
  error = this.optService.error;

  readonly frequencyOptions = [
    { label: this.translate.instant('optimization.freq.daily'),   value: 'daily' },
    { label: this.translate.instant('optimization.freq.weekly'),  value: 'weekly' },
    { label: this.translate.instant('optimization.freq.monthly'), value: 'monthly' },
  ];
  triggerLoading = signal(false);

  // Report viewer
  showReportDialog = signal(false);
  reportDialogCrew = signal('');
  reportDialogContent = signal('');
  reportLoading = signal(false);
  editMode = signal(false);

  ngOnInit(): void {
    this.optService.load();
  }

  getCrewLabel(crewName: string): string {
    const key = `optimization.crews.${crewName}`;
    const translated = this.translate.instant(key);
    return translated === key ? crewName : translated;
  }

  getSeverity(status?: string): 'success' | 'danger' | 'warn' | 'info' | null {
    switch ((status ?? '').toLowerCase()) {
      case 'active': return 'success';
      case 'paused': return 'warn';
      default: return 'info';
    }
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    return this.locale.formatDate(iso, { dateStyle: 'short', timeStyle: 'short' });
  }

  formatBytes(bytes?: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  async onFrequencyChange(record: OptimizationRecord, frequency: string): Promise<void> {
    await this.optService.updateSchedule(record.crew_name, frequency);
  }

  async onToggleStatus(record: OptimizationRecord): Promise<void> {
    const newStatus = record.status === 'active' ? 'paused' : 'active';
    await this.optService.toggleStatus(record.crew_name, newStatus);
  }

  async onTriggerRun(): Promise<void> {
    this.triggerLoading.set(true);
    await this.optService.triggerRun(7);
    this.triggerLoading.set(false);
  }

  async onViewReport(record: OptimizationRecord): Promise<void> {
    this.reportDialogCrew.set(record.crew_name);
    this.reportDialogContent.set('');
    this.showReportDialog.set(true);
    this.reportLoading.set(true);
    this.editMode.set(false);

    const detail = await this.optService.getReport(record.crew_name);
    this.reportDialogContent.set(detail?.report_content || this.translate.instant('optimization.noReport'));
    this.reportLoading.set(false);
  }

  async onSaveReport(): Promise<void> {
    this.reportLoading.set(true);
    await this.optService.updateReport(this.reportDialogCrew(), this.reportDialogContent());
    this.reportLoading.set(false);
    this.editMode.set(false);
  }

  onCloseReport(): void {
    this.showReportDialog.set(false);
    this.editMode.set(false);
  }
}
