import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbDialogRef } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Tiny confirmation modal used by ConfirmDialogService. Built with the
 * Nebular dialog primitives so it inherits the corporate theme.
 *
 * Inputs are translate keys; render-time params come through `messageParams`.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, NbCardModule, NbButtonModule, TranslatePipe],
  template: `
    <nb-card class="confirm-card" style="min-width:320px;max-width:480px">
      <nb-card-header>
        <h6 style="margin:0">{{ titleKey | translate: messageParams }}</h6>
      </nb-card-header>
      <nb-card-body>
        <p style="margin:0">{{ messageKey | translate: messageParams }}</p>
      </nb-card-body>
      <nb-card-footer style="display:flex;gap:8px;justify-content:flex-end">
        <button nbButton status="basic" (click)="cancel()">
          {{ cancelKey | translate }}
        </button>
        <button nbButton [status]="danger ? 'danger' : 'primary'" (click)="confirm()">
          {{ confirmKey | translate }}
        </button>
      </nb-card-footer>
    </nb-card>
  `,
})
export class ConfirmDialogComponent {
  private ref = inject(NbDialogRef<ConfirmDialogComponent>);

  titleKey = 'common.confirm.title';
  messageKey = 'common.confirm.message';
  confirmKey = 'common.confirm.confirm';
  cancelKey = 'common.confirm.cancel';
  danger = false;
  messageParams: Record<string, unknown> = {};

  confirm(): void { this.ref.close(true); }
  cancel(): void  { this.ref.close(false); }
}
