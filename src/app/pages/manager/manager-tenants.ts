import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NbCardModule, NbButtonModule, NbBadgeModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { ManagerService, TenantSummary } from '../../libs/service/manager.service';
import { LocaleService } from '../../core/locale.service';

@Component({
  selector: 'manager-tenants',
  templateUrl: './manager-tenants.html',
  styleUrl: './manager-tenants.scss',
  imports: [
    CommonModule, RouterLink, TranslatePipe,
    NbCardModule, NbButtonModule, NbBadgeModule, NbIconModule, NbSpinnerModule,
    TableModule, TagModule, InputTextModule, IconField, InputIcon,
  ],
})
export class ManagerTenants implements OnInit {
  private managerService = inject(ManagerService);
  private translate      = inject(TranslateService);
  private localeSvc      = inject(LocaleService);

  tenants = signal<TenantSummary[]>([]);
  loading = signal(true);
  error   = signal<string | null>(null);

  globalFilterFields = [
    'tenant_id', 'name', 'contact_email', 'plan_slug', 'workspace_provider',
  ];

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.managerService.getTenants();
      this.tenants.set(res.items);
    } catch (e: any) {
      this.error.set(e?.error?.message || this.translate.instant('manager.tenants.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  statusSeverity(t: TenantSummary): 'success' | 'danger' {
    return t.is_active ? 'success' : 'danger';
  }

  onboardingPct(t: TenantSummary): number {
    return (t.onboarding as any)?.completion_pct ?? (t.onboarding_complete ? 100 : 0);
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    return this.localeSvc.formatDate(iso, { dateStyle: 'short' });
  }
}
