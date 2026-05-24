/**
 * Share-links dashboard page — vorrai-app/dashboard/share-links.
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NbCardModule, NbButtonModule, NbIconModule, NbBadgeModule,
  NbSpinnerModule, NbToastrService,
} from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ClinicShareLinksService,
  ShareLinksResponse,
} from '../../libs/service/clinic-share-links.service';

@Component({
  selector: 'share-links',
  templateUrl: './share-links.html',
  styleUrl: './share-links.scss',
  imports: [
    CommonModule, TranslatePipe,
    NbCardModule, NbButtonModule, NbIconModule, NbBadgeModule, NbSpinnerModule,
  ],
})
export class ShareLinks implements OnInit {
  private service   = inject(ClinicShareLinksService);
  private toastr    = inject(NbToastrService);
  private translate = inject(TranslateService);

  links   = signal<ShareLinksResponse | null>(null);
  loading = signal(true);
  error   = signal<string | null>(null);

  async ngOnInit() {
    try {
      this.links.set(await this.service.list());
    } catch (e: any) {
      this.error.set(e?.error?.Message || e?.message || this.translate.instant('common.toast.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  /** `labelKey` is a translate key like `shareLinks.toast.copiedShareText`. */
  async copy(value: string, labelKey: string) {
    try {
      await navigator.clipboard.writeText(value);
      const label = this.translate.instant(labelKey);
      this.toastr.success(`${label} ✓`, this.translate.instant('shareLinks.toast.copied'), { duration: 2000 });
    } catch {
      this.toastr.warning(
        this.translate.instant('shareLinks.toast.copyFailed'),
        this.translate.instant('common.toast.error'),
      );
    }
  }

  /** Quick wa.me link tester — open in a new tab. */
  open(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
