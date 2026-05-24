import { Injectable, inject } from '@angular/core';
import { NbToastrService, NbComponentStatus } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

/**
 * MessagesService — central point for emitting user-facing toast / snackbar
 * messages. Always translate-key based so the same call site renders in any
 * UI locale; pass interpolation params via the second argument.
 *
 * Replaces direct `NbToastrService` literal-string calls across the app.
 * Page components should inject this instead of NbToastrService for any
 * message that's meant for a human.
 */
@Injectable({ providedIn: 'root' })
export class MessagesService {
  private toastr    = inject(NbToastrService);
  private translate = inject(TranslateService);

  success(key: string, params?: Record<string, unknown>): void {
    this._show('success', key, params);
  }

  warning(key: string, params?: Record<string, unknown>): void {
    this._show('warning', key, params);
  }

  danger(key: string, params?: Record<string, unknown>): void {
    this._show('danger', key, params);
  }

  info(key: string, params?: Record<string, unknown>): void {
    this._show('info', key, params);
  }

  /** Shorthand for the most common case (success without a title). */
  ok(key: string, params?: Record<string, unknown>): void {
    this.success(key, params);
  }

  private _show(status: NbComponentStatus, key: string, params?: Record<string, unknown>): void {
    const message = this.translate.instant(key, params);
    this.toastr.show(message, '', { status, duration: 3500 });
  }
}
