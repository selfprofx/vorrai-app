/**
 * Clinic-profile editor — vorrai-app/clinic-profile.
 *
 * The doctor edits their directory-facing profile here. When published,
 * this profile is what appears at `vorrai.co/clinics/<slug>` and as the
 * "author card" footer on every post they write to vorrai.co/blog.
 *
 * Two distinct buttons:
 *   - "Save changes" → PUT the form fields, profile stays in its current
 *     publish state (a published clinic can keep editing without dropping
 *     out of the directory).
 *   - "Publish" / "Hide from directory" → toggle visibility. Publish is
 *     server-validated (refuses without display_name + slug + primary_specialty).
 *
 * For list fields (services, secondary_specialties, languages, accepted_insurances)
 * we use comma-separated text inputs. A proper tag-input UX comes in a
 * follow-up; comma-separated is the lowest-friction MVP and the server
 * accepts the JSON array shape either way.
 *
 * Image uploads (avatar, hero) are deferred — the doctor pastes an S3
 * key once one of the existing image-upload paths has stored it. The
 * presigned-upload flow specifically for profile images is its own
 * focused iteration.
 */
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbCheckboxModule,
  NbIconModule, NbBadgeModule, NbSelectModule, NbSpinnerModule,
  NbToastrService,
} from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ClinicProfileService, ClinicProfile, ClinicProfileInput,
} from '../../libs/service/clinic-profile.service';
import { KnowledgeService, type KnowledgeSource } from '../../libs/service/knowledge.service';
import { AuthService } from '../../libs/service/auth.service';
import { ConfirmDialogService } from '../../core/confirm-dialog.service';

/** Same curated IANA-ish jurisdiction list the agent crews use. */
const JURISDICTIONS = ['BR', 'EU', 'UK', 'US'];

function joinList(arr: string[] | null | undefined): string {
  return (arr || []).join(', ');
}

function splitList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

@Component({
  selector: 'clinic-profile',
  templateUrl: './clinic-profile.html',
  styleUrl: './clinic-profile.scss',
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    NbCardModule, NbButtonModule, NbInputModule, NbCheckboxModule,
    NbIconModule, NbBadgeModule, NbSelectModule, NbSpinnerModule,
  ],
})
export class ClinicProfileEditor implements OnInit {
  private service = inject(ClinicProfileService);
  private toastr  = inject(NbToastrService);
  private knowledge = inject(KnowledgeService);
  private auth    = inject(AuthService);
  private translate = inject(TranslateService);
  private confirmSvc = inject(ConfirmDialogService);

  // ── Account identity (moved from /settings?tab=profile) ────
  readonly tenantId  = computed(() => this.auth.getTenantId() ?? '—');
  readonly isManager = computed(() => this.auth.isManager());

  loading = signal(true);
  saving  = signal(false);
  error   = signal<string | null>(null);
  uploadingAvatar = signal(false);
  uploadingHero   = signal(false);

  /** The server-authoritative copy — only mutated after a successful save. */
  remote = signal<ClinicProfile | null>(null);

  // Form fields (flat for two-way binding). List fields are kept as
  // comma-separated strings to match the input UX, then split on save.
  slug              = signal('');
  display_name      = signal('');
  tagline           = signal('');
  bio_md            = signal('');
  primary_specialty = signal('');
  secondary_specialties_raw = signal('');
  services_raw       = signal('');
  languages_raw      = signal('');
  accepted_insurances_raw = signal('');
  city              = signal('');
  state             = signal('');
  country_code      = signal('');
  jurisdiction      = signal('');
  avatar_image_s3_key = signal('');
  hero_image_s3_key   = signal('');
  website_url       = signal('');
  instagram_handle  = signal('');
  patient_chat_path = signal('');
  booking_wa_me_url = signal('');
  directory_opt_in  = signal(false);

  // ── Knowledge Base state (moved from settings) ────────────
  kbSources       = signal<KnowledgeSource[]>([]);
  kbMemory        = signal<string | null>(null);
  kbChecklist     = signal<string | null>(null);
  kbLoading       = signal(false);
  kbUploading     = signal(false);
  kbDeleting      = signal<string | null>(null);
  kbFiles         = signal<File[]>([]);
  kbYoutubeUrl    = signal('');
  kbYoutubeUrls   = signal<string[]>([]);
  kbTextInputs    = signal<Array<{ title: string; content: string }>>([]);
  kbShowAddModal  = signal(false);
  kbExpanded      = signal(false);  // collapsed by default; expand-to-load

  expandKnowledge() {
    if (this.kbExpanded()) return;
    this.kbExpanded.set(true);
    this.loadKnowledge();
  }

  jurisdictions = JURISDICTIONS;

  readonly publishable = computed(() =>
    this.display_name().trim().length > 0
    && this.slug().trim().length > 0
    && this.primary_specialty().trim().length > 0
  );

  readonly publicUrl = computed(() => {
    const r = this.remote();
    if (!r?.published || !r?.directory_opt_in) return null;
    return `https://vorrai.co/clinics/${r.slug}`;
  });

  async ngOnInit() {
    // KB is opt-in: the user has to expand the section before we hit
    // /knowledge/* endpoints. Keeps the page render path lean and stops
    // every clinic-profile visit from logging KB 500s while the backend
    // surface is still under construction.
    try {
      const data = await this.service.get();
      this.applyServer(data);
    } catch (e: any) {
      this.error.set(e?.error?.Message || e?.message || this.translate.instant('clinicProfile.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Sync form signals from a fresh server payload. */
  private applyServer(data: ClinicProfile) {
    this.remote.set(data);
    this.slug.set(data.slug || '');
    this.display_name.set(data.display_name || '');
    this.tagline.set(data.tagline || '');
    this.bio_md.set(data.bio_md || '');
    this.primary_specialty.set(data.primary_specialty || '');
    this.secondary_specialties_raw.set(joinList(data.secondary_specialties));
    this.services_raw.set(joinList(data.services));
    this.languages_raw.set(joinList(data.languages));
    this.accepted_insurances_raw.set(joinList(data.accepted_insurances));
    this.city.set(data.city || '');
    this.state.set(data.state || '');
    this.country_code.set(data.country_code || '');
    this.jurisdiction.set(data.jurisdiction || '');
    this.avatar_image_s3_key.set(data.avatar_image_s3_key || '');
    this.hero_image_s3_key.set(data.hero_image_s3_key || '');
    this.website_url.set(data.website_url || '');
    this.instagram_handle.set(data.instagram_handle || '');
    this.patient_chat_path.set(data.patient_chat_path || '');
    this.booking_wa_me_url.set(data.booking_wa_me_url || '');
    this.directory_opt_in.set(data.directory_opt_in);
  }

  /** Build the PUT payload from form signals. */
  private buildPayload(): ClinicProfileInput {
    return {
      slug: this.slug().trim() || undefined,
      display_name: this.display_name().trim() || undefined,
      tagline: this.tagline().trim() || undefined,
      bio_md: this.bio_md(),                                  // allow empty string to clear
      primary_specialty: this.primary_specialty().trim() || undefined,
      secondary_specialties: splitList(this.secondary_specialties_raw()),
      services: splitList(this.services_raw()),
      languages: splitList(this.languages_raw()),
      accepted_insurances: splitList(this.accepted_insurances_raw()),
      city: this.city().trim() || undefined,
      state: this.state().trim() || undefined,
      country_code: (this.country_code().trim() || '').toUpperCase() || undefined,
      jurisdiction: this.jurisdiction() || undefined,
      avatar_image_s3_key: this.avatar_image_s3_key().trim() || undefined,
      hero_image_s3_key: this.hero_image_s3_key().trim() || undefined,
      website_url: this.website_url().trim() || undefined,
      instagram_handle: this.instagram_handle().trim() || undefined,
      patient_chat_path: this.patient_chat_path().trim() || undefined,
      booking_wa_me_url: this.booking_wa_me_url().trim() || undefined,
      directory_opt_in: this.directory_opt_in(),
    };
  }

  async save() {
    this.saving.set(true);
    try {
      const data = await this.service.save(this.buildPayload());
      this.applyServer(data);
      this.toastr.success(
        this.translate.instant('clinicProfile.toast.saved'),
        this.translate.instant('clinicProfile.toast.savedTitle'),
        { duration: 2000 },
      );
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || this.translate.instant('clinicProfile.toast.saveError'),
        this.translate.instant('clinicProfile.toast.errorTitle'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async publish() {
    if (!this.publishable()) {
      this.toastr.warning(
        this.translate.instant('clinicProfile.actions.publishHint'),
        this.translate.instant('clinicProfile.toast.errorTitle'),
      );
      return;
    }
    this.saving.set(true);
    try {
      await this.service.save(this.buildPayload());
      const data = await this.service.publish();
      this.applyServer(data);
      this.toastr.success(
        this.translate.instant('clinicProfile.toast.published'),
        this.translate.instant('clinicProfile.toast.publishedTitle'),
        { duration: 2500 },
      );
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || this.translate.instant('clinicProfile.toast.saveError'),
        this.translate.instant('clinicProfile.toast.errorTitle'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Browser → S3 upload, then PUT the resulting key onto the profile.
   *
   * Uses the two-step flow inside `ClinicProfileService.uploadImage`: ask
   * the backend for a presigned URL, then PUT bytes directly to S3 (avoids
   * Lambda's 6 MB payload limit and the egress cost of double-hopping).
   * Once we have the key, save it onto the profile so a refresh shows the
   * preview from the S3 URL.
   */
  async pickAvatar(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadingAvatar.set(true);
    try {
      const s3_key = await this.service.uploadImage('avatar', file);
      const data = await this.service.save({ avatar_image_s3_key: s3_key });
      this.applyServer(data);
      this.toastr.success(
        this.translate.instant('clinicProfile.toast.saved'),
        this.translate.instant('clinicProfile.toast.savedTitle'),
        { duration: 2000 },
      );
    } catch (e: any) {
      this.toastr.danger(
        e?.message || this.translate.instant('clinicProfile.toast.uploadFailed'),
        this.translate.instant('clinicProfile.toast.errorTitle'),
      );
    } finally {
      this.uploadingAvatar.set(false);
      input.value = '';
    }
  }

  async pickHero(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadingHero.set(true);
    try {
      const s3_key = await this.service.uploadImage('hero', file);
      const data = await this.service.save({ hero_image_s3_key: s3_key });
      this.applyServer(data);
      this.toastr.success(
        this.translate.instant('clinicProfile.toast.saved'),
        this.translate.instant('clinicProfile.toast.savedTitle'),
        { duration: 2000 },
      );
    } catch (e: any) {
      this.toastr.danger(
        e?.message || this.translate.instant('clinicProfile.toast.uploadFailed'),
        this.translate.instant('clinicProfile.toast.errorTitle'),
      );
    } finally {
      this.uploadingHero.set(false);
      input.value = '';
    }
  }

  /** Clear the key locally — doctor must hit Save to persist. */
  clearAvatar() { this.avatar_image_s3_key.set(''); }
  clearHero()   { this.hero_image_s3_key.set(''); }

  /** Build a display URL from an S3 key (assumes public-read bucket or
   *  CloudFront-fronted). Returns null when the key is empty. */
  imageUrl(s3Key: string | null | undefined): string | null {
    const k = (s3Key || '').trim();
    if (!k) return null;
    const base = (window as any).VORRAI_MEDIA_BASE
      || 'https://vendia-media.s3.amazonaws.com';
    return `${base}/${k.replace(/^\/+/, '')}`;
  }

  async hideFromDirectory() {
    const ok = await this.confirmSvc.confirm({
      messageKey: 'clinicProfile.toast.kbConfirmDelete',
      confirmKey: 'clinicProfile.actions.hideDirectory',
    });
    if (!ok) return;
    this.saving.set(true);
    try {
      const data = await this.service.hideFromDirectory();
      this.applyServer(data);
      this.toastr.success(
        this.translate.instant('clinicProfile.toast.hidden'),
        this.translate.instant('clinicProfile.toast.hiddenTitle'),
        { duration: 2000 },
      );
    } catch (e: any) {
      this.toastr.danger(
        e?.error?.Message || e?.message || this.translate.instant('clinicProfile.toast.saveError'),
        this.translate.instant('clinicProfile.toast.errorTitle'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  // ── Knowledge Base ──────────────────────────────────────────────────────
  // Curates the tenant memory + brand checklist + uploaded sources that
  // power the AI clone. Previously lived under /settings?tab=knowledge.

  async loadKnowledge() {
    this.kbLoading.set(true);
    try {
      const [sourcesRes, memoryRes, checklistRes] = await Promise.all([
        this.knowledge.listSources(),
        this.knowledge.getMemory(),
        this.knowledge.getChecklist(),
      ]);
      this.kbSources.set(sourcesRes.sources);
      this.kbMemory.set(memoryRes.memory);
      this.kbChecklist.set(checklistRes.checklist);
    } catch {
      this.toastr.danger(
        this.translate.instant('clinicProfile.toast.loadFailed'),
        this.translate.instant('clinicProfile.toast.errorTitle'),
      );
    } finally {
      this.kbLoading.set(false);
    }
  }

  kbOnFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.kbFiles.update(f => [...f, ...Array.from(input.files!)]);
    }
  }

  kbRemoveFile(index: number) {
    this.kbFiles.update(f => f.filter((_, i) => i !== index));
  }

  kbAddYoutubeUrl() {
    const url = this.kbYoutubeUrl().trim();
    if (url) {
      this.kbYoutubeUrls.update(u => [...u, url]);
      this.kbYoutubeUrl.set('');
    }
  }

  kbRemoveYoutubeUrl(index: number) {
    this.kbYoutubeUrls.update(u => u.filter((_, i) => i !== index));
  }

  kbAddTextInput() {
    this.kbTextInputs.update(t => [...t, { title: '', content: '' }]);
  }

  kbRemoveTextInput(index: number) {
    this.kbTextInputs.update(t => t.filter((_, i) => i !== index));
  }

  kbUpdateTextInput(index: number, field: 'title' | 'content', value: string) {
    this.kbTextInputs.update(t => t.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  private kbGetSourceType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio';
    return 'pdf';
  }

  async kbUploadAndIngest() {
    this.kbUploading.set(true);
    try {
      for (const file of this.kbFiles()) {
        const res = await this.knowledge.getUploadUrl(file.name, this.kbGetSourceType(file.name), file.name);
        await fetch(res.upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': 'application/octet-stream' } });
      }
      await this.knowledge.triggerIngestion(
        this.kbYoutubeUrls().map(url => ({ url, title: url })),
        this.kbTextInputs().filter(t => t.content.trim()),
      );
      this.kbFiles.set([]);
      this.kbYoutubeUrls.set([]);
      this.kbTextInputs.set([]);
      this.kbShowAddModal.set(false);
      this.toastr.success(
        this.translate.instant('clinicProfile.toast.kbUploaded'),
        this.translate.instant('clinicProfile.toast.kbUploadedTitle'),
      );
      setTimeout(() => this.loadKnowledge(), 3000);
    } catch {
      this.toastr.danger(
        this.translate.instant('clinicProfile.toast.saveError'),
        this.translate.instant('clinicProfile.toast.errorTitle'),
      );
    } finally {
      this.kbUploading.set(false);
    }
  }

  async kbDeleteSource(sourceId: string) {
    this.kbDeleting.set(sourceId);
    try {
      await this.knowledge.deleteSource(sourceId);
      this.kbSources.update(s => s.filter(x => x.source_id !== sourceId));
      this.toastr.success(
        this.translate.instant('clinicProfile.toast.kbDeleted'),
        this.translate.instant('clinicProfile.toast.kbUploadedTitle'),
      );
      setTimeout(() => this.loadKnowledge(), 5000);
    } catch {
      this.toastr.danger(
        this.translate.instant('clinicProfile.toast.kbDeleteFailed'),
        this.translate.instant('clinicProfile.toast.errorTitle'),
      );
    } finally {
      this.kbDeleting.set(null);
    }
  }
}
