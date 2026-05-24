import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';

import { TranslatePipe } from '@ngx-translate/core';
import { ContentService } from '../../libs/service/content.service';
import { TenantSettingsService } from '../../libs/service/tenant-settings.service';
import { LabelService } from '../../core/label.service';
import { LocaleService } from '../../core/locale.service';
import type { ContentJob, ContentCreateRequest } from '../../libs/model/content-job';

type ViewMode = 'list' | 'detail' | 'create' | 'success';

@Component({
  selector: 'contents',
  imports: [
    CommonModule, FormsModule,
    NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule,
    TableModule, Tag, ButtonModule, InputTextModule, SelectModule, TextareaModule,
    IconField, InputIcon, TranslatePipe,
  ],
  templateUrl: './contents.html',
  styleUrl: './contents.scss',
})
export class Contents implements OnInit {
  private contentService = inject(ContentService);
  private tenantSettings = inject(TenantSettingsService);
  private router = inject(Router);
  private localeSvc = inject(LocaleService);
  objectKeys = Object.keys;

  /** Reactive label dictionary — flips with the tenant's vertical. */
  protected labels = inject(LabelService).labels;

  jobs   = this.contentService.jobs;
  loading = this.contentService.loading;
  error   = this.contentService.error;

  view = signal<ViewMode>('list');
  selectedJob = signal<ContentJob | null>(null);
  detailLoading = signal(false);
  creating = signal(false);
  lastCreatedJobId = signal<string | null>(null);

  // Quota
  quotaLimit = signal(100);
  quotaUsed = signal(0);
  quotaLoaded = signal(false);

  // Create form
  form: ContentCreateRequest = this._defaultForm();

  jobTypeOptions = [
    { label: 'Default Hero', value: 'default_hero' },
  ];

  deliveryModeOptions = [
    { label: 'Full', value: 'full' },
    { label: 'Novel Sequence (7-part)', value: 'novel_sequence' },
  ];

  editorialTypeOptions = [
    { label: 'Clazz', value: 'Clazz' },
    { label: 'Interview', value: 'Interview' },
    { label: 'Lists', value: 'Lists' },
    { label: 'Infographics', value: 'Infographics' },
    { label: 'Q&A', value: 'Q_A' },
    { label: 'Curiosities', value: 'Curiosities' },
  ];

  audienceStateOptions = [
    { label: 'Awareness', value: 'Awareness' },
    { label: 'Opportunity', value: 'Opportunity' },
    { label: 'Urgency', value: 'Urgency' },
  ];

  outputFormatOptions = [
    { label: 'Image Post', value: 'IMAGE_POST' },
    { label: 'Carousel', value: 'CAROUSEL' },
    { label: 'Newsletter', value: 'NEWSLETTER' },
    { label: 'Story 9x16', value: 'STORY_9x16' },
    { label: 'Video Short', value: 'VIDEO_SHORT' },
  ];

  async ngOnInit() {
    this.contentService.load();
    await this.tenantSettings.load();
    this._updateQuota();
  }

  showList() {
    this.view.set('list');
    this.selectedJob.set(null);
  }

  showCreate() {
    this.view.set('create');
  }

  async showDetail(job: ContentJob) {
    this.view.set('detail');
    this.detailLoading.set(true);
    const full = await this.contentService.getById(job.job_id);
    this.selectedJob.set(full ?? job);
    this.detailLoading.set(false);
  }

  async submitCreate() {
    this.creating.set(true);
    const result = await this.contentService.create(this.form);
    this.creating.set(false);
    if (result) {
      this.lastCreatedJobId.set(result.job_id);
      await this.contentService.load();
      await this.tenantSettings.load();
      this._updateQuota();
      this.view.set('success');
    }
  }

  resetAndCreate() {
    this.form = this._defaultForm();
    this.view.set('create');
  }

  goToJobs() {
    this.router.navigate(['/content-jobs']);
  }

  get quotaExhausted(): boolean {
    return this.quotaLoaded() && this.quotaUsed() >= this.quotaLimit();
  }

  getSeverity(status?: string | null): 'success' | 'danger' | 'info' | 'secondary' | 'warn' | 'contrast' {
    switch ((status ?? '').toLowerCase()) {
      case 'completed': return 'success';
      case 'failed':    return 'danger';
      case 'running':   return 'warn';
      default:          return 'info';
    }
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    try { return this.localeSvc.formatDate(iso, { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; }
  }

  toggleOutputFormat(value: string) {
    const current = this.form.output_formats ?? [];
    const idx = current.indexOf(value);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(value);
    }
    this.form.output_formats = [...current];
  }

  hasOutputFormat(value: string): boolean {
    return (this.form.output_formats ?? []).includes(value);
  }

  private _defaultForm(): ContentCreateRequest {
    return {
      job_type: 'default_hero',
      delivery_mode: 'full',
      briefing: '',
      editorial_type: 'Clazz',
      audience_state: 'Awareness',
      output_formats: ['IMAGE_POST'],
    };
  }

  private _updateQuota() {
    const s = this.tenantSettings.settings();
    if (s) {
      this.quotaLimit.set(s.content_jobs_limit_monthly ?? 100);
      this.quotaUsed.set(s.content_jobs_used_month ?? 0);
      this.quotaLoaded.set(true);
    }
  }
}
