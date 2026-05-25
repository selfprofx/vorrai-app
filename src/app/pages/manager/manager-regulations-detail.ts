import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  RegulationVersionSummary,
  RegulationDetail,
  CreateRegulationPayload,
} from '../../libs/service/manager.service';
import { LocaleService } from '../../core/locale.service';

/**
 * Timeline view for a single market_key.
 *
 * Each row is a version with semver chip, created/activated/deactivated
 * timestamps, actor handles, and an inline rules editor (textarea, JSON).
 * Editing is allowed only on rows that have never been activated; the
 * server enforces this independently — we just hide the buttons.
 *
 * Action buttons per row:
 *   - Edit       (draft only)
 *   - Activate   (any non-active, non-deleted row)
 *   - Delete     (draft only — server rejects historical deletes with 409)
 *
 * Activating a major-bump version pops a confirm dialog explaining the
 * regulatory-instrument-replacement consequence; only after the manager
 * acknowledges is the request resent with `confirm_major_bump=true`.
 */
@Component({
  selector: 'manager-regulations-detail',
  templateUrl: './manager-regulations-detail.html',
  styleUrl: './manager-regulations-detail.scss',
  imports: [
    CommonModule, FormsModule, RouterLink, TranslatePipe,
    NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule, NbInputModule,
    TableModule, TagModule, DialogModule, ButtonModule,
  ],
})
export class ManagerRegulationsDetail implements OnInit {
  private route          = inject(ActivatedRoute);
  private managerService = inject(ManagerService);
  private translate      = inject(TranslateService);
  private localeSvc      = inject(LocaleService);
  private toastr         = inject(NbToastrService);

  marketKey = signal<string>('');
  versions  = signal<RegulationVersionSummary[]>([]);
  detailsCache = signal<Record<string, RegulationDetail>>({});
  expandedVersion = signal<string | null>(null);
  loading   = signal(true);
  error     = signal<string | null>(null);

  readonly activeVersion = computed(() =>
    this.versions().find(v => v.is_active) ?? null,
  );

  // Per-version edit-form state (single edit at a time).
  editingVersion = signal<string | null>(null);
  editRulesText = '';
  editSourcesText = '';
  editChangelog = '';
  saving = signal(false);

  // New-version dialog state.
  newDialogVisible = signal(false);
  newVersion = '';
  newChangelog = '';
  newRulesText = '';

  // Major-bump confirm dialog state.
  majorBumpDialogVisible = signal(false);
  majorBumpTarget = signal<RegulationVersionSummary | null>(null);

  async ngOnInit() {
    const key = decodeURIComponent(this.route.snapshot.paramMap.get('marketKey') ?? '');
    this.marketKey.set(key);
    await this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.managerService.getRegulationVersions(this.marketKey());
      this.versions.set(res.versions);
    } catch (e: any) {
      this.error.set(e?.error?.message || this.translate.instant('regulations.detail.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── per-row expansion ────────────────────────────────────────────────────

  async toggleExpand(version: string) {
    if (this.expandedVersion() === version) {
      this.expandedVersion.set(null);
      return;
    }
    if (!this.detailsCache()[version]) {
      try {
        const detail = await this.managerService.getRegulationVersion(this.marketKey(), version);
        this.detailsCache.update(c => ({ ...c, [version]: detail }));
      } catch (e: any) {
        this.toastr.danger(
          e?.error?.message || this.translate.instant('regulations.detail.loadVersionFailed'),
          this.translate.instant('regulations.detail.errorTitle'),
        );
        return;
      }
    }
    this.expandedVersion.set(version);
  }

  detailFor(version: string): RegulationDetail | null {
    return this.detailsCache()[version] ?? null;
  }

  // ── edit (draft only) ────────────────────────────────────────────────────

  startEdit(version: RegulationVersionSummary) {
    const detail = this.detailFor(version.version);
    if (!detail) return;
    this.editingVersion.set(version.version);
    this.editRulesText = JSON.stringify(detail.rules || {}, null, 2);
    this.editSourcesText = JSON.stringify(detail.sources || [], null, 2);
    this.editChangelog = detail.changelog || '';
  }

  cancelEdit() {
    this.editingVersion.set(null);
  }

  async saveEdit(version: string) {
    let rules: Record<string, unknown>;
    let sources: unknown[];
    try {
      rules = JSON.parse(this.editRulesText || '{}');
    } catch {
      this.toastr.danger(
        this.translate.instant('regulations.detail.invalidRulesJson'),
        this.translate.instant('regulations.detail.errorTitle'),
      );
      return;
    }
    try {
      sources = JSON.parse(this.editSourcesText || '[]');
      if (!Array.isArray(sources)) throw new Error('sources must be an array');
    } catch {
      this.toastr.danger(
        this.translate.instant('regulations.detail.invalidSourcesJson'),
        this.translate.instant('regulations.detail.errorTitle'),
      );
      return;
    }

    this.saving.set(true);
    try {
      const updated = await this.managerService.updateRegulationVersion(
        this.marketKey(), version,
        { rules, sources, changelog: this.editChangelog },
      );
      this.detailsCache.update(c => ({ ...c, [version]: updated }));
      this.editingVersion.set(null);
      this.toastr.success(
        this.translate.instant('regulations.detail.savedToast'),
        this.translate.instant('regulations.detail.savedTitle'),
      );
      await this.load();
    } catch (e: any) {
      this.handleApiError(e, 'regulations.detail.saveFailed');
    } finally {
      this.saving.set(false);
    }
  }

  // ── activate (with major-bump confirm gate) ───────────────────────────────

  async activate(version: RegulationVersionSummary, confirmMajorBump = false) {
    this.saving.set(true);
    try {
      const res = await this.managerService.activateRegulationVersion(
        this.marketKey(), version.version, confirmMajorBump,
      );
      this.toastr.success(
        this.translate.instant('regulations.detail.activatedToast', { version: res.activated.version }),
        this.translate.instant('regulations.detail.activatedTitle'),
      );
      this.majorBumpDialogVisible.set(false);
      this.majorBumpTarget.set(null);
      await this.load();
    } catch (e: any) {
      // Major-bump branch: the API returns 400 with `code: major_bump_requires_confirm`.
      const body = e?.error;
      if (!confirmMajorBump && body?.code === 'major_bump_requires_confirm') {
        this.majorBumpTarget.set(version);
        this.majorBumpDialogVisible.set(true);
      } else {
        this.handleApiError(e, 'regulations.detail.activateFailed');
      }
    } finally {
      this.saving.set(false);
    }
  }

  async confirmMajorBump() {
    const target = this.majorBumpTarget();
    if (target) await this.activate(target, true);
  }

  // ── delete (draft only) ──────────────────────────────────────────────────

  async deleteVersion(version: RegulationVersionSummary) {
    const msg = this.translate.instant('regulations.detail.confirmDelete', { version: version.version });
    if (!window.confirm(msg)) return;
    this.saving.set(true);
    try {
      await this.managerService.deleteRegulationVersion(this.marketKey(), version.version);
      this.toastr.info(
        this.translate.instant('regulations.detail.deletedToast', { version: version.version }),
        this.translate.instant('regulations.detail.deletedTitle'),
      );
      await this.load();
    } catch (e: any) {
      this.handleApiError(e, 'regulations.detail.deleteFailed');
    } finally {
      this.saving.set(false);
    }
  }

  // ── new version (in this market) ─────────────────────────────────────────

  openNewVersion() {
    // Default the new version to a patch bump above whatever's at the top of the timeline.
    const top = this.versions()[0];
    this.newVersion = top ? this.suggestNextVersion(top.version) : 'v0.1.0';
    this.newChangelog = '';
    // Default the rules editor to the active row's rules so the manager
    // starts from "in force" and edits forward.
    const active = this.activeVersion();
    const activeDetail = active ? this.detailFor(active.version) : null;
    this.newRulesText = activeDetail
      ? JSON.stringify(activeDetail.rules || {}, null, 2)
      : '{\n  "banned_phrases": [],\n  "banned_patterns": [],\n  "required_elements": []\n}';
    this.newDialogVisible.set(true);
  }

  async createVersion() {
    if (!this.newVersion?.trim() || !this.newChangelog?.trim()) {
      this.toastr.warning(
        this.translate.instant('regulations.new.requiredFields'),
        this.translate.instant('regulations.new.invalidTitle'),
      );
      return;
    }
    let rules: Record<string, unknown>;
    try {
      rules = JSON.parse(this.newRulesText || '{}');
    } catch {
      this.toastr.danger(
        this.translate.instant('regulations.new.invalidJson'),
        this.translate.instant('regulations.new.invalidTitle'),
      );
      return;
    }

    // Derive country/vertical from the existing market (or fall back from
    // the market_key string when no versions exist yet).
    const reference = this.versions()[0];
    const [countryFromKey, verticalFromKey] = this.marketKey().split('#');
    const payload: CreateRegulationPayload = {
      country_code: reference?.country_code ?? countryFromKey,
      vertical: reference?.vertical ?? verticalFromKey ?? 'clinical',
      version: this.newVersion.trim(),
      display_name: reference?.display_name,
      rules,
      sources: [],
      changelog: this.newChangelog.trim(),
    };

    this.saving.set(true);
    try {
      await this.managerService.createRegulationVersion(this.marketKey(), payload);
      this.toastr.success(
        this.translate.instant('regulations.new.createdToast', {
          market: this.marketKey(), version: payload.version,
        }),
        this.translate.instant('regulations.new.createdTitle'),
      );
      this.newDialogVisible.set(false);
      await this.load();
    } catch (e: any) {
      this.handleApiError(e, 'regulations.new.createFailed');
    } finally {
      this.saving.set(false);
    }
  }

  // ── small helpers ───────────────────────────────────────────────────────

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    return this.localeSvc.formatDate(iso, { dateStyle: 'short', timeStyle: 'short' });
  }

  /** Suggested patch bump from `vMAJOR.MINOR.PATCH`. Falls back to v0.1.0
   *  on a non-semver input so we never block the new-version dialog. */
  suggestNextVersion(current: string): string {
    const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(current);
    if (!m) return 'v0.1.0';
    return `v${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
  }

  /** Map server error → toast. Keeps the specific `code` keys
   *  (`version_immutable`, `historical_version`) distinguishable. */
  private handleApiError(e: any, fallbackKey: string) {
    const code = e?.error?.code;
    if (code === 'version_immutable') {
      this.toastr.warning(
        this.translate.instant('regulations.errors.versionImmutable'),
        this.translate.instant('regulations.detail.errorTitle'),
      );
      return;
    }
    if (code === 'historical_version') {
      this.toastr.warning(
        this.translate.instant('regulations.errors.historicalVersion'),
        this.translate.instant('regulations.detail.errorTitle'),
      );
      return;
    }
    this.toastr.danger(
      e?.error?.message || e?.message || this.translate.instant(fallbackKey),
      this.translate.instant('regulations.detail.errorTitle'),
    );
  }
}
