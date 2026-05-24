import { Injectable, inject } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from './confirm-dialog.component';

export interface ConfirmOptions {
  /** Translate key for the dialog header. Defaults to `common.confirm.title`. */
  titleKey?: string;
  /** Translate key for the body copy. Required. */
  messageKey: string;
  /** Translate key for the destructive/primary button. Defaults to `common.confirm.confirm`. */
  confirmKey?: string;
  /** Translate key for the cancel button. Defaults to `common.confirm.cancel`. */
  cancelKey?: string;
  /** Render the primary button in danger colour (use for destructive ops). */
  danger?: boolean;
  /** Interpolation params passed to both title and message. */
  params?: Record<string, unknown>;
}

/**
 * Promise-based replacement for `window.confirm()`. Browser-native confirms
 * can't be localized and look out of place in the corporate Nebular theme;
 * everything that prompted for confirmation should funnel through here.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private dialog = inject(NbDialogService);

  async confirm(opts: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      context: {
        titleKey:      opts.titleKey   ?? 'common.confirm.title',
        messageKey:    opts.messageKey,
        confirmKey:    opts.confirmKey ?? 'common.confirm.confirm',
        cancelKey:     opts.cancelKey  ?? 'common.confirm.cancel',
        danger:        opts.danger     ?? false,
        messageParams: opts.params     ?? {},
      },
      closeOnBackdropClick: true,
      hasBackdrop: true,
    });
    const result = await firstValueFrom(ref.onClose);
    return result === true;
  }
}
