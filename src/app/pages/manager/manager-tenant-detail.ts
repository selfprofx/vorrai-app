import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  NbCardModule, NbButtonModule, NbBadgeModule, NbIconModule,
  NbSpinnerModule, NbTabsetModule, NbProgressBarModule,
} from '@nebular/theme';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import {
  ManagerService, TenantDetail, TenantUser, TenantFollowup, TenantContentJob,
} from '../../libs/service/manager.service';

@Component({
  selector: 'manager-tenant-detail',
  templateUrl: './manager-tenant-detail.html',
  styleUrl: './manager-tenant-detail.scss',
  imports: [
    CommonModule, RouterLink,
    NbCardModule, NbButtonModule, NbBadgeModule, NbIconModule,
    NbSpinnerModule, NbTabsetModule, NbProgressBarModule,
    TableModule, TagModule, InputTextModule, IconField, InputIcon,
  ],
})
export class ManagerTenantDetail implements OnInit {
  private route          = inject(ActivatedRoute);
  private managerService = inject(ManagerService);

  tenantId = signal<string>('');
  tenant   = signal<TenantDetail | null>(null);
  users    = signal<TenantUser[]>([]);
  followups = signal<TenantFollowup[]>([]);
  content  = signal<TenantContentJob[]>([]);

  loadingHeader   = signal(true);
  loadingUsers    = signal(false);
  loadingFollowups = signal(false);
  loadingContent  = signal(false);
  error = signal<string | null>(null);

  readonly onboarding = computed(() => this.tenant()?.onboarding ?? {});
  readonly onboardingPct = computed(() => (this.onboarding() as any)?.completion_pct ?? 0);
  readonly onboardingStage = computed(() => (this.onboarding() as any)?.current_stage ?? '?');
  readonly sesVerified = computed(() => !!(this.onboarding() as any)?.ses_verified);
  readonly domainVerified = computed(() => !!(this.onboarding() as any)?.domain_verified);
  readonly activePlans = computed(() => this.tenant()?.active_plans ?? []);
  readonly socialCounts = computed(() => this.tenant()?.social_counts ?? { instagram: 0, whatsapp: 0, tiktok: 0 });

  userFilterFields    = ['name', 'full_name', 'email', 'chat_state', 'utm_persona'];
  followupFilterFields = ['email', 'article_title', 'email_subject', 'status'];
  contentFilterFields = ['job_id', 'content_type', 'article_title', 'status'];

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('tenantId') ?? '';
    this.tenantId.set(id);
    await Promise.all([
      this.loadHeader(id),
      this.loadUsers(id),
      this.loadFollowups(id),
      this.loadContent(id),
    ]);
  }

  async loadHeader(id: string) {
    this.loadingHeader.set(true);
    try {
      this.tenant.set(await this.managerService.getTenant(id));
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Failed to load tenant.');
    } finally {
      this.loadingHeader.set(false);
    }
  }

  async loadUsers(id: string) {
    this.loadingUsers.set(true);
    try {
      const res = await this.managerService.getTenantUsers(id);
      this.users.set(res.items);
    } catch { /* non-fatal */ }
    finally { this.loadingUsers.set(false); }
  }

  async loadFollowups(id: string) {
    this.loadingFollowups.set(true);
    try {
      const res = await this.managerService.getTenantFollowups(id);
      this.followups.set(res.items);
    } catch { /* non-fatal */ }
    finally { this.loadingFollowups.set(false); }
  }

  async loadContent(id: string) {
    this.loadingContent.set(true);
    try {
      const res = await this.managerService.getTenantContent(id);
      this.content.set(res.items);
    } catch { /* non-fatal */ }
    finally { this.loadingContent.set(false); }
  }

  followupSeverity(status?: string | null): 'success' | 'danger' | 'info' {
    switch ((status ?? '').toLowerCase()) {
      case 'sent': return 'success';
      case 'failed': return 'danger';
      default: return 'info';
    }
  }

  contentSeverity(status?: string | null): 'success' | 'warn' | 'info' | 'danger' {
    switch ((status ?? '').toLowerCase()) {
      case 'done':
      case 'completed': return 'success';
      case 'pending':
      case 'in_progress': return 'warn';
      case 'failed': return 'danger';
      default: return 'info';
    }
  }

  chatStateSeverity(state?: string | null): 'success' | 'warn' | 'info' | 'secondary' {
    if (!state) return 'secondary';
    const s = state.toLowerCase();
    if (s.includes('closed') || s.includes('deal')) return 'success';
    if (s.includes('active') || s.includes('engage')) return 'warn';
    return 'info';
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }
}
