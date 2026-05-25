import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbSpinnerModule, NbButtonModule, NbInputModule, NbAlertModule, NbToggleModule } from '@nebular/theme';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { NbToastrService } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { GlobalConfigService } from '../../libs/service/global-config.service';
import { ManagerService, type TenantSummary } from '../../libs/service/manager.service';

@Component({
  selector: 'manager-global-config',
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    NbCardModule, NbSpinnerModule, NbButtonModule, NbInputModule, NbAlertModule, NbToggleModule,
    SelectModule, ButtonModule, Tag,
  ],
  templateUrl: './manager-global-config.html',
  styleUrl: './manager-global-config.scss',
})
export class ManagerGlobalConfig implements OnInit {
  protected configService = inject(GlobalConfigService);
  private managerService = inject(ManagerService);
  private toastr = inject(NbToastrService);
  private translate = inject(TranslateService);

  loading = this.configService.loading;
  saving = this.configService.saving;
  error = this.configService.error;

  // Global defaults form
  globalMaxContentJobs = 100;
  globalMaxChat = 512;
  globalMaxAgent = 2048;

  // Notification master switches
  globalNotifLeads = true;
  globalNotifChats = true;
  globalNotifContent = true;
  globalNotifFollowups = true;
  globalNotifBookings = true;
  notifSaving = this.configService.notifSaving;

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
      this.configService.loadGlobalNotifications(),
      this.loadTenants(),
    ]);
    this._syncGlobalForm();
    this._syncNotifForm();
  }

  async saveGlobal() {
    try {
      await this.configService.saveGlobal({
        max_content_jobs_per_month: this.globalMaxContentJobs,
        max_chat_input_chars: this.globalMaxChat,
        max_agent_input_chars: this.globalMaxAgent,
      });
      this._syncGlobalForm();
      this.toastr.success(
        this.translate.instant('manager.globalConfig.toast.globalSaved'),
        this.translate.instant('manager.globalConfig.toast.globalSavedTitle'),
      );
    } catch {
      this.toastr.danger(
        this.configService.error() ?? this.translate.instant('manager.globalConfig.toast.saveFailed'),
        this.translate.instant('manager.globalConfig.toast.errorTitle'),
      );
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
      this.toastr.success(
        this.translate.instant('manager.globalConfig.toast.overrideSaved'),
        this.translate.instant('manager.globalConfig.toast.overrideSavedTitle'),
      );
    } catch {
      this.toastr.danger(
        this.configService.error() ?? this.translate.instant('manager.globalConfig.toast.saveFailed'),
        this.translate.instant('manager.globalConfig.toast.errorTitle'),
      );
    }
  }

  async removeOverride() {
    if (!this.selectedTenantId) return;
    await this.configService.deleteTenantOverride(this.selectedTenantId);
    this.hasOverride.set(false);
    this._resetOverrideToGlobal();
    this.toastr.info(
      this.translate.instant('manager.globalConfig.toast.overrideRemoved'),
      this.translate.instant('manager.globalConfig.toast.overrideRemovedTitle'),
    );
  }

  async saveGlobalNotifications() {
    try {
      await this.configService.saveGlobalNotifications({
        global_notif_leads: this.globalNotifLeads,
        global_notif_chats: this.globalNotifChats,
        global_notif_content: this.globalNotifContent,
        global_notif_followups: this.globalNotifFollowups,
        global_notif_bookings: this.globalNotifBookings,
      });
      this._syncNotifForm();
      this.toastr.success(
        this.translate.instant('manager.globalConfig.toast.notifSaved'),
        this.translate.instant('manager.globalConfig.toast.notifSavedTitle'),
      );
    } catch {
      this.toastr.danger(
        this.configService.error() ?? this.translate.instant('manager.globalConfig.toast.saveFailed'),
        this.translate.instant('manager.globalConfig.toast.errorTitle'),
      );
    }
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

  private _syncNotifForm() {
    const n = this.configService.globalNotifConfig();
    this.globalNotifLeads = n.global_notif_leads;
    this.globalNotifChats = n.global_notif_chats;
    this.globalNotifContent = n.global_notif_content;
    this.globalNotifFollowups = n.global_notif_followups;
    this.globalNotifBookings = n.global_notif_bookings;
  }
}
