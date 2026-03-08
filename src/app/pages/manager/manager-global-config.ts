import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbSpinnerModule, NbButtonModule, NbInputModule, NbAlertModule } from '@nebular/theme';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { NbToastrService } from '@nebular/theme';

import { GlobalConfigService } from '../../libs/service/global-config.service';
import { ManagerService, type TenantSummary } from '../../libs/service/manager.service';

@Component({
  selector: 'manager-global-config',
  imports: [
    CommonModule, FormsModule,
    NbCardModule, NbSpinnerModule, NbButtonModule, NbInputModule, NbAlertModule,
    SelectModule, ButtonModule, Tag,
  ],
  templateUrl: './manager-global-config.html',
  styleUrl: './manager-global-config.scss',
})
export class ManagerGlobalConfig implements OnInit {
  protected configService = inject(GlobalConfigService);
  private managerService = inject(ManagerService);
  private toastr = inject(NbToastrService);

  loading = this.configService.loading;
  saving = this.configService.saving;
  error = this.configService.error;

  // Global defaults form
  globalMaxContentJobs = 100;
  globalMaxChat = 512;
  globalMaxAgent = 2048;

  // Tenant override form
  tenants = signal<TenantSummary[]>([]);
  selectedTenantId = '';
  overrideMaxContentJobs = 100;
  overrideMaxChat = 512;
  overrideMaxAgent = 2048;
  hasOverride = signal(false);
  overrideLoading = signal(false);

  get tenantOptions() {
    return this.tenants().map(t => ({
      label: `${t.name} (${t.tenant_id})`,
      value: t.tenant_id,
    }));
  }

  async ngOnInit() {
    await Promise.all([
      this.configService.loadGlobal(),
      this.loadTenants(),
    ]);
    this._syncGlobalForm();
  }

  async saveGlobal() {
    try {
      await this.configService.saveGlobal({
        max_content_jobs_per_month: this.globalMaxContentJobs,
        max_chat_input_chars: this.globalMaxChat,
        max_agent_input_chars: this.globalMaxAgent,
      });
      this._syncGlobalForm();
      this.toastr.success('Global configuration saved.', 'Global Config');
    } catch {
      this.toastr.danger(this.configService.error() ?? 'Failed to save.', 'Error');
    }
  }

  async onTenantSelected() {
    if (!this.selectedTenantId) return;
    this.overrideLoading.set(true);
    await this.configService.loadTenantOverride(this.selectedTenantId);
    const override = this.configService.tenantOverride();
    if (override?.has_override) {
      this.hasOverride.set(true);
      this.overrideMaxContentJobs = override.max_content_jobs_per_month;
      this.overrideMaxChat = override.max_chat_input_chars;
      this.overrideMaxAgent = override.max_agent_input_chars;
    } else {
      this.hasOverride.set(false);
      this._resetOverrideToGlobal();
    }
    this.overrideLoading.set(false);
  }

  async saveOverride() {
    if (!this.selectedTenantId) return;
    try {
      await this.configService.saveTenantOverride(this.selectedTenantId, {
        max_content_jobs_per_month: this.overrideMaxContentJobs,
        max_chat_input_chars: this.overrideMaxChat,
        max_agent_input_chars: this.overrideMaxAgent,
      });
      this.hasOverride.set(true);
      this.toastr.success('Tenant override saved.', 'Override');
    } catch {
      this.toastr.danger(this.configService.error() ?? 'Failed to save.', 'Error');
    }
  }

  async removeOverride() {
    if (!this.selectedTenantId) return;
    await this.configService.deleteTenantOverride(this.selectedTenantId);
    this.hasOverride.set(false);
    this._resetOverrideToGlobal();
    this.toastr.info('Tenant override removed. Global defaults apply.', 'Override Removed');
  }

  private async loadTenants() {
    try {
      const res = await this.managerService.getTenants();
      this.tenants.set(res.items);
    } catch {
      // Non-critical — tenant selector just won't populate
    }
  }

  private _syncGlobalForm() {
    const cfg = this.configService.globalConfig();
    if (cfg) {
      this.globalMaxContentJobs = cfg.max_content_jobs_per_month;
      this.globalMaxChat = cfg.max_chat_input_chars;
      this.globalMaxAgent = cfg.max_agent_input_chars;
    }
  }

  private _resetOverrideToGlobal() {
    const cfg = this.configService.globalConfig();
    this.overrideMaxContentJobs = cfg?.max_content_jobs_per_month ?? 100;
    this.overrideMaxChat = cfg?.max_chat_input_chars ?? 512;
    this.overrideMaxAgent = cfg?.max_agent_input_chars ?? 2048;
  }
}
