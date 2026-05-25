import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import {
  NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule, NbInputModule,
  NbToastrService,
} from '@nebular/theme';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  ManagerService,
  RegulationMarket,
  CreateRegulationPayload,
} from '../../libs/service/manager.service';
import { LocaleService } from '../../core/locale.service';

/**
 * Manager-only landing page for the country-aware clinical content engine.
 *
 * Shows one row per `{country_code}#{vertical}` market with its
 * currently-active semver version. Drilling into a row opens the timeline
 * page where versions are created, edited (while still draft), activated,
 * or soft-deleted.
 *
 * The "+ New Market" dialog bootstraps a `v0.1.0` draft for a never-seen
 * market — sub-version work happens on the detail page so the timeline
 * view stays the canonical place a manager edits regulations.
 */
@Component({
  selector: 'manager-regulations',
  templateUrl: './manager-regulations.html',
  styleUrl: './manager-regulations.scss',
  imports: [
    CommonModule, FormsModule, RouterLink, TranslatePipe,
    NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule, NbInputModule,
    TableModule, TagModule, DialogModule, ButtonModule,
  ],
})
export class ManagerRegulations implements OnInit {
  private managerService = inject(ManagerService);
  private translate      = inject(TranslateService);
  private localeSvc      = inject(LocaleService);
  private toastr         = inject(NbToastrService);
  private router         = inject(Router);

  markets = signal<RegulationMarket[]>([]);
  loading = signal(true);
  error   = signal<string | null>(null);

  // New-market dialog state
  newDialogVisible = signal(false);
  saving = signal(false);
  newCountry = '';
  newVertical = 'clinical';
  newVersion = 'v0.1.0';
  newDisplayName = '';
  newChangelog = '';
  newRulesText = '{\n  "banned_phrases": [],\n  "banned_patterns": [],\n  "required_elements": []\n}';

  globalFilterFields = ['market_key', 'country_code', 'vertical', 'display_name', 'active_version'];

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.managerService.listRegulations();
      this.markets.set(res.items);
    } catch (e: any) {
      this.error.set(e?.error?.message || this.translate.instant('regulations.list.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  openNewMarket() {
    this.newCountry = '';
    this.newVertical = 'clinical';
    this.newVersion = 'v0.1.0';
    this.newDisplayName = '';
    this.newChangelog = '';
    this.newDialogVisible.set(true);
  }

  async createMarket() {
    if (!this.newCountry?.trim() || !this.newChangelog?.trim()) {
      this.toastr.warning(
        this.translate.instant('regulations.new.requiredFields'),
        this.translate.instant('regulations.new.invalidTitle'),
      );
      return;
    }
    let rules: Record<string, unknown>;
    try {
      rules = JSON.parse(this.newRulesText);
    } catch {
      this.toastr.danger(
        this.translate.instant('regulations.new.invalidJson'),
        this.translate.instant('regulations.new.invalidTitle'),
      );
      return;
    }

    const payload: CreateRegulationPayload = {
      country_code: this.newCountry.trim().toUpperCase(),
      vertical: this.newVertical.trim() || 'clinical',
      version: this.newVersion.trim(),
      display_name: this.newDisplayName.trim() || undefined,
      rules,
      sources: [],
      changelog: this.newChangelog.trim(),
    };

    this.saving.set(true);
    try {
      const created = await this.managerService.createRegulationVersion(
        `${payload.country_code}#${payload.vertical}`, payload,
      );
      this.toastr.success(
        this.translate.instant('regulations.new.createdToast', { market: created.market_key, version: created.version }),
        this.translate.instant('regulations.new.createdTitle'),
      );
      this.newDialogVisible.set(false);
      await this.load();
      // Jump into the detail view so the manager can activate it.
      this.router.navigate(['/manager/regulations', created.market_key]);
    } catch (e: any) {
      const msg = e?.error?.message || e?.error?.Message || e?.message
        || this.translate.instant('regulations.new.createFailed');
      this.toastr.danger(msg, this.translate.instant('regulations.new.invalidTitle'));
    } finally {
      this.saving.set(false);
    }
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    return this.localeSvc.formatDate(iso, { dateStyle: 'short', timeStyle: 'short' });
  }

  activeSeverity(m: RegulationMarket): 'success' | 'warn' {
    return m.active_version ? 'success' : 'warn';
  }
}
