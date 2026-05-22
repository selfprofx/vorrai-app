import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../libs/service/auth.service';
import { AiChatService } from '../../libs/service/ai-chat.service';

/**
 * Dashboard hero — a personalised Vorrai greeting banner.
 * Greets by time of day and signed-in user; clicking it opens the
 * Vorrai AI Receptionist chat panel.
 */
@Component({
  selector: 'app-greeting-banner',
  standalone: true,
  template: `
    <div class="greeting-banner" role="button" tabindex="0"
         (click)="open()" (keyup.enter)="open()">
      <img src="assets/og-base.jpg" alt="" class="greeting-banner__bg">
      <div class="greeting-banner__text">
        <p class="greeting-banner__hello">{{ greeting() }}</p>
        <p class="greeting-banner__sub">Your clinic at a glance — tap to ask your Vorrai AI Receptionist.</p>
        <span class="greeting-banner__cta">Open the AI Receptionist &rarr;</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .greeting-banner {
      position: relative;
      width: 100%;
      height: 200px;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid var(--v-border);
      box-shadow: 0 1px 2px var(--v-card-shadow);
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .greeting-banner:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 30px rgba(0, 75, 60, 0.13);
    }
    .greeting-banner:focus-visible {
      outline: 2px solid var(--v-border-focus);
      outline-offset: 2px;
    }

    .greeting-banner__bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
    }

    /* Marble White wash on the left keeps the greeting legible */
    .greeting-banner::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 1;
      background: linear-gradient(to right,
        rgba(250, 249, 246, 0.97) 0%,
        rgba(250, 249, 246, 0.86) 40%,
        rgba(250, 249, 246, 0.36) 62%,
        rgba(250, 249, 246, 0) 80%);
    }

    .greeting-banner__text {
      position: absolute;
      z-index: 2;
      left: 36px;
      top: 50%;
      transform: translateY(-50%);
      max-width: 60%;
    }
    .greeting-banner__hello {
      margin: 0;
      font-family: var(--v-font-heading);
      font-size: 30px;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: -0.015em;
      color: var(--v-text);
    }
    .greeting-banner__sub {
      margin: 8px 0 0;
      font-family: var(--v-font-body);
      font-size: 14px;
      color: var(--v-text-muted);
    }
    .greeting-banner__cta {
      display: inline-block;
      margin-top: 14px;
      font-family: var(--v-font-body);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: var(--v-accent);
    }
  `],
})
export class GreetingBannerComponent {
  private auth = inject(AuthService);
  private aiChat = inject(AiChatService);

  /**
   * Time-of-day greeting personalised by who is signed in:
   * doctors/managers as "Dr. <name>", receptionists by their own name,
   * a clean time-of-day greeting when only an email is on file.
   */
  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning'
               : hour < 18 ? 'Good afternoon'
               : 'Good evening';
    const dn = this.auth.displayName();
    const hasName = !!dn && !dn.includes('@');
    const role = this.auth.role();
    let who: string | null;
    if (role === 'doctor' || role === 'manager') {
      who = hasName ? `Dr. ${dn}` : 'Doctor';
    } else {
      who = hasName ? dn! : null;
    }
    return who ? `${part}, ${who}.` : `${part}.`;
  });

  open(): void {
    if (!this.aiChat.isOpen()) this.aiChat.toggle();
  }
}
