import { Component, signal, computed, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { NbMenuService, NbMenuItem } from '@nebular/theme';
import { filter, map } from 'rxjs/operators';

import {
  NbSidebarModule,
  NbLayoutModule,
  NbCardModule,
  NbButtonModule,
  NbIconModule,
  NbSidebarService,
  NbMenuModule,
  NbUserModule,
  NbContextMenuModule,
} from '@nebular/theme';

import { NbEvaIconsModule } from '@nebular/eva-icons';
import { AuthService } from './libs/service/auth.service';
import { AppWsService } from './libs/service/app-ws.service';
import { NotificationService, BadgeCounts } from './libs/service/notification.service';
import { AiChatService } from './libs/service/ai-chat.service';
import { AiAssistantComponent } from './components/ai-assistant/ai-assistant';
import { NotificationBellComponent } from './components/notification-bell/notification-bell';
import { TenantSettingsService } from './libs/service/tenant-settings.service';
import { LabelService } from './core/label.service';

/** Maps route paths to badge count categories */
const ROUTE_TO_BADGE: Record<string, keyof BadgeCounts> = {
  '/users': 'leads',
  '/chats': 'chats',
  '/followups': 'followups',
  '/content-jobs': 'content',
  '/bookings': 'bookings',
};

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',

  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    NbLayoutModule,
    NbCardModule,
    NbButtonModule,
    NbIconModule,
    NbEvaIconsModule,
    NbContextMenuModule,
    NbSidebarModule,
    NbUserModule,
    NbMenuModule,
    AiAssistantComponent,
    NotificationBellComponent,
  ],
})
export class App implements OnInit {
  protected readonly title = signal('angular-app');

  readonly displayName = computed(() => this.auth.displayName() || 'User');

  readonly topMenuItems = computed(() => [
    { title: this.auth.email() || this.displayName(), group: true },
    { title: 'Profile', icon: 'person-outline' },
    { title: 'Settings', icon: 'settings-2-outline' },
    { title: 'Log out', icon: 'log-out-outline' },
  ]);

  private notificationService = inject(NotificationService);
  private tenantSettingsService = inject(TenantSettingsService);
  private labelService = inject(LabelService);
  protected aiChat = inject(AiChatService);

  readonly menuItems = signal<NbMenuItem[]>([]);

  constructor(
    private nbMenuService: NbMenuService,
    private sidebarService: NbSidebarService,
    private router: Router,
    protected auth: AuthService,
    private appWs: AppWsService,
  ) {
    // Reactively rebuild menu items when badge counts or labels change.
    // Reading `labelService.labels()` inside the effect makes the menu
    // recompute the moment the tenant's vertical (and therefore the
    // dictionary) flips between marketing and clinical.
    effect(() => {
      const counts = this.notificationService.badgeCounts();
      this.labelService.labels();
      this.menuItems.set(this._buildMenu(counts));
    });
  }

  private _buildMenu(counts: BadgeCounts): NbMenuItem[] {
    const badge = (cat: keyof BadgeCounts) =>
      counts[cat] > 0
        ? { text: String(counts[cat]), status: 'danger' }
        : undefined;

    const L = this.labelService.labels();
    const role = this.auth.role();

    // ── Role gating ────────────────────────────────────────────────────────
    // Manager and doctor see the full menu. Receptionist sees only the
    // operational surfaces they're allowed to write to (or are read-safe
    // patient-facing routes). Content/blog/products/personas/offers/courses/
    // council/optimization/clinic-profile are all doctor-write surfaces — the
    // backend rejects writes from receptionists via `_require_doctor`, so we
    // hide them from the sidebar to avoid a misleading "click → 403" UX.
    const isDoctorTier = role === 'doctor' || role === 'manager';

    const home: NbMenuItem[] = [
      { title: L.groupHome, group: true },
      { title: L.dashboard, link: '/dashboard', icon: 'home-outline' },
      { title: L.bookings,  link: '/bookings',  icon: 'calendar-outline',       badge: badge('bookings') },
      { title: L.leads,     link: '/users',     icon: 'people-outline',         badge: badge('leads') },
      { title: L.chats,     link: '/chats',     icon: 'message-circle-outline', badge: badge('chats') },
    ];

    // Clinical ops — locations + staff are tenant-read-safe (backend allows
    // read for both roles, hides write buttons in the page for receptionists).
    // share-links is read-safe for both. clinic-profile is doctor-only.
    const clinicOps: NbMenuItem[] = [
      { title: 'Clinic ops', group: true },
      { title: 'Locations',  link: '/locations',  icon: 'pin-outline' },
      { title: 'Staff',      link: '/staff',      icon: 'people-outline' },
      { title: 'Share-links', link: '/share-links', icon: 'share-outline' },
      ...(isDoctorTier ? [
        { title: 'Clinic profile', link: '/clinic-profile', icon: 'globe-outline' },
      ] : []),
    ];

    // Doctor-only content + management groups.
    const content: NbMenuItem[] = isDoctorTier ? [
      { title: L.groupContent, group: true },
      { title: L.followups,   link: '/followups',         icon: 'email-outline',     badge: badge('followups') },
      { title: L.templates,   link: '/email-templates',   icon: 'email-outline' },
      { title: L.contents,    link: '/contents',          icon: 'book-open-outline' },
      { title: L.contentJobs, link: '/content-jobs',      icon: 'layers-outline',    badge: badge('content') },
      { title: L.blog,        link: '/blog',              icon: 'book-outline' },
      { title: L.subscribers, link: '/blog/subscribers',  icon: 'people-outline' },
    ] : [];

    const management: NbMenuItem[] = isDoctorTier ? [
      { title: L.groupManagement, group: true },
      { title: L.products,       link: '/products',         icon: 'cube-outline' },
      { title: L.personas,       link: '/personas',         icon: 'people-outline' },
      { title: L.offers,         link: '/offers',           icon: 'pricetags-outline' },
      { title: L.courses,        link: '/courses',          icon: 'award-outline' },
      { title: L.council,        link: '/council/ask',      icon: 'bulb-outline' },
      { title: L.councilHistory, link: '/council/sessions', icon: 'archive-outline' },
      { title: L.optimization,   link: '/optimization',     icon: 'trending-up-outline' },
    ] : [];

    const main: NbMenuItem[] = [...home, ...clinicOps, ...content, ...management];

    const managerMenu: NbMenuItem[] = [
      { title: L.groupManager, group: true },
      { title: 'Overview',      link: '/manager',                icon: 'monitor-outline' },
      { title: 'All Tenants',   link: '/manager/tenants',        icon: 'grid-outline' },
      { title: 'Global Config', link: '/manager/global-config',  icon: 'settings-2-outline' },
    ];

    return this.auth.isManager()
      ? [...main, ...managerMenu]
      : [...main];
  }

  toggleSidebar() {
    this.sidebarService.getSidebarState('menu-sidebar')
      .subscribe(state => {
        if (state === 'expanded') {
          this.sidebarService.compact('menu-sidebar');
        } else {
          this.sidebarService.expand('menu-sidebar');
        }
      });
  }

  async ngOnInit() {
    // Wait for session restore, then connect WebSocket if authenticated
    await this.auth.ready;
    if (this.auth.isAuthenticated()) {
      this.appWs.connect();
      this.notificationService.init();
      // Load tenant settings so the LabelService can swap to the clinical
      // dictionary when tenant.vertical === 'clinical'. Fire and forget —
      // the labels signal will flip the menu reactively.
      this.tenantSettingsService.load();
    }

    this.nbMenuService
      .onItemClick()
      .pipe(
        filter(({ tag }) => tag === 'profile-menu'),
        map(({ item: { title } }) => title),
      )
      .subscribe(async (title) => {
        if (title === 'Log out') {
          this.appWs.disconnect();
          await this.auth.signOut();
        } else if (title === 'Profile') {
          this.router.navigate(['/settings'], { queryParams: { tab: 'profile' } });
        } else if (title === 'Settings') {
          this.router.navigate(['/settings'], { queryParams: { tab: 'tenant-settings' } });
        }
      });

    // Clear badge counts when navigating to a page + deselect sidebar items
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(({ urlAfterRedirects }) => {
        const path = urlAfterRedirects.split('?')[0];

        // Clear badge for the page being navigated to
        const category = ROUTE_TO_BADGE[path];
        if (category) {
          this.notificationService.clearBadgeForPage(category);
        }

        // Deselect all sidebar items when on a route not in the sidebar
        const sidebarPaths = this.menuItems()
          .filter(i => i.link)
          .map(i => i.link);
        if (!sidebarPaths.includes(path)) {
          this.menuItems().forEach(i => {
            if (!i.group) { (i as any).selected = false; }
          });
        }
      });
  }
}
