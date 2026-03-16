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

import { OptimizationService } from '../../libs/service/optimization.service';
import type { OptimizationRecord } from '../../libs/model/optimization';

const CREW_LABELS: Record<string, string> = {
  presales: 'Presales Agents Crew',
  content_creation: 'Content Creation Agents Crew',
  nurture: 'Nurture Agents Crew',
  postsale: 'Postsale Agents Crew',
  ai_employee: 'AI Employee Agents Crew',
  onboarding: 'Onboarding Agents Crew',
};

const FREQUENCY_OPTIONS = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

@Component({
  selector: 'app-optimization',
  imports: [
    CommonModule, FormsModule,
    TableModule, Tag, ButtonModule, SelectModule, DialogModule, TextareaModule,
    NbCardModule, NbSpinnerModule, NbToggleModule,
  ],
  templateUrl: './optimization.html',
})
export class Optimization implements OnInit {
  private optService = inject(OptimizationService);

  records = this.optService.records;
  loading = this.optService.loading;
  error = this.optService.error;

  frequencyOptions = FREQUENCY_OPTIONS;
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
    return CREW_LABELS[crewName] || crewName;
  }

  getSeverity(status?: string): 'success' | 'danger' | 'warn' | 'info' | null {
    switch ((status ?? '').toLowerCase()) {
      case 'active': return 'success';
      case 'paused': return 'warn';
      default: return 'info';
    }
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '\u2014';
    return new Date(iso).toLocaleString();
  }

  formatBytes(bytes?: number): string {
    if (!bytes) return '\u2014';
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
    this.reportDialogContent.set(detail?.report_content || 'No report available yet.');
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
