import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ai-logo-svg',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 200 250"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Vendia AI"
      [class]="isResponding ? 'vendia-logo responding' : 'vendia-logo'"
      style="flex-shrink:0;overflow:visible"
    >
      <defs>
        <linearGradient [attr.id]="'bg-grad-'+uid" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stop-color="#0E1111" />
          <stop offset="50%"  stop-color="#004B3C" />
          <stop offset="100%" stop-color="#0E1111" />
        </linearGradient>
        <linearGradient [attr.id]="'gold-grad-'+uid" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#FFD700" />
          <stop offset="50%"  stop-color="#F9E79F" />
          <stop offset="100%" stop-color="#FFD700" />
        </linearGradient>
        <linearGradient [attr.id]="'gold-dark-'+uid" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stop-color="#B89A00" />
          <stop offset="100%" stop-color="#FFD700" />
        </linearGradient>
        <linearGradient [attr.id]="'pillar-grad-'+uid" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stop-color="#002A21" />
          <stop offset="20%"  stop-color="#004B3C" />
          <stop offset="50%"  stop-color="#008066" />
          <stop offset="80%"  stop-color="#004B3C" />
          <stop offset="100%" stop-color="#002A21" />
        </linearGradient>
        <filter [attr.id]="'glow-'+uid" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- Background Diamond -->
      <polygon points="100,5 195,125 100,245 5,125"
               [attr.fill]="'url(#bg-grad-'+uid+')'"
               stroke="#004B3C" stroke-width="2" />
      <polygon points="100,20 180,125 100,230 20,125"
               fill="none" stroke="#00FFFF" stroke-width="0.5" stroke-opacity="0.3" />

      <!-- Central Pillar Structure -->
      <path d="M 75 190 Q 100 210 125 190 L 115 110 L 85 110 Z" fill="#002A21" />
      <path d="M 80 60 Q 100 40 120 60 L 115 110 L 85 110 Z"    fill="#002A21" />
      <rect x="85" y="70" width="30" height="120" rx="15"
            [attr.fill]="'url(#pillar-grad-'+uid+')'" />

      <!-- Responding Energy Lines -->
      <path class="pillar-energy"
            d="M 100 190 L 100 70"
            stroke="#00FFFF" stroke-width="3" stroke-linecap="round"
            stroke-dasharray="10 20" />
      <path class="pillar-energy"
            d="M 90 180 L 90 80"
            stroke="#FAF9F6" stroke-width="1" stroke-dasharray="5 15"
            style="animation-duration:1.5s" />
      <path class="pillar-energy"
            d="M 110 180 L 110 80"
            stroke="#FAF9F6" stroke-width="1" stroke-dasharray="5 15"
            style="animation-duration:1.5s" />

      <!-- Gold Filigree -->
      <g class="gold-filigree">
        <path d="M 5 125 L 100 245 L 195 125 L 165 125 L 100 210 L 35 125 Z"
              [attr.fill]="'url(#gold-grad-'+uid+')'" />
        <path d="M 35 125 C 50 160, 80 170, 80 190 C 70 180, 50 150, 20 120 Z"
              [attr.fill]="'url(#gold-dark-'+uid+')'" />
        <path d="M 20 120 C 30 100, 60 70, 80 60 C 60 80, 40 100, 35 125 Z"
              [attr.fill]="'url(#gold-grad-'+uid+')'" />
        <path d="M 165 125 C 150 160, 120 170, 120 190 C 130 180, 150 150, 180 120 Z"
              [attr.fill]="'url(#gold-dark-'+uid+')'" />
        <path d="M 180 120 C 170 100, 140 70, 120 60 C 140 80, 160 100, 165 125 Z"
              [attr.fill]="'url(#gold-grad-'+uid+')'" />
        <path d="M 100 5 L 140 50 L 120 50 L 100 25 L 80 50 L 60 50 Z"
              [attr.fill]="'url(#gold-grad-'+uid+')'" />
        <path d="M 75 75 Q 100 90 125 75 Q 100 65 75 75 Z"
              [attr.fill]="'url(#gold-grad-'+uid+')'" />
        <path d="M 75 180 Q 100 165 125 180 Q 100 190 75 180 Z"
              [attr.fill]="'url(#gold-grad-'+uid+')'" />
      </g>

      <!-- Top Crown / Jewel Motif -->
      <g>
        <path d="M 100 20 C 125 45, 115 75, 100 75 C 85 75, 75 45, 100 20 Z"
              fill="#002A21" stroke="#00FFFF" stroke-width="1.5" />
        <polygon points="100,5 110,25 100,40 90,25"
                 fill="#0E1111" stroke="#FFD700" stroke-width="1" />
        <polygon points="100,10 105,25 100,35 95,25"
                 fill="#00FFFF" opacity="0.8" />
        <circle cx="92" cy="55" r="4"
                fill="#00FFFF" class="anim-eye anim-pulse-slow"
                [attr.filter]="'url(#glow-'+uid+')'" />
        <circle cx="108" cy="55" r="4"
                fill="#00FFFF" class="anim-eye anim-pulse-slow"
                [attr.filter]="'url(#glow-'+uid+')'" />
        <circle cx="92"  cy="55" r="1.5" fill="#0E1111" />
        <circle cx="108" cy="55" r="1.5" fill="#0E1111" />
      </g>

      <!-- Scattered Cyan Gems -->
      <g fill="#00FFFF"
         [attr.filter]="'url(#glow-'+uid+')'"
         class="anim-pulse-slow">
        <circle cx="50"  cy="155" r="3.5" />
        <circle cx="150" cy="155" r="3.5" />
        <circle cx="75"  cy="200" r="4"   />
        <circle cx="125" cy="200" r="4"   />
        <circle cx="35"  cy="125" r="3"   />
        <circle cx="165" cy="125" r="3"   />
        <circle cx="100" cy="225" r="4.5" />
      </g>
    </svg>
  `,
})
export class AiLogoSvgComponent {
  @Input() isResponding = false;
  @Input() size = 38;
  readonly uid = Math.random().toString(36).slice(2);
}
