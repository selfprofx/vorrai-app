import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Vorrai AI mark — a round profile photo of the Vorrai character.
 * Keeps the `size` / `isResponding` API so existing call sites
 * (launcher + panel header) need no change.
 */
@Component({
  selector: 'app-ai-logo-svg',
  standalone: true,
  imports: [CommonModule],
  template: `
    <img
      src="assets/vorrai-profile.jpg"
      alt="Vorrai"
      [width]="size"
      [height]="size"
      [class.responding]="isResponding"
      class="vorrai-avatar"
    />
  `,
  styles: [`
    .vorrai-avatar {
      display: block;
      flex-shrink: 0;
      border-radius: 50%;
      object-fit: cover;
      object-position: center 35%;
      border: 1.5px solid var(--v-border, #D6E2DA);
      background: var(--v-surface, #FFFFFF);
    }
    .vorrai-avatar.responding {
      animation: vorrai-avatar-pulse 1.4s ease-in-out infinite;
    }
    @keyframes vorrai-avatar-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(0, 75, 60, 0.35); }
      50%      { box-shadow: 0 0 0 5px rgba(0, 75, 60, 0); }
    }
  `],
})
export class AiLogoSvgComponent {
  @Input() isResponding = false;
  @Input() size = 38;
}
