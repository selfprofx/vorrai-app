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
import { ThemeService } from './libs/service/theme.service';

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

  topMenuItems = [
    { title: 'Profile', icon: 'person-outline' },
    { title: 'Settings', icon: 'settings-2-outline' },
    { title: 'Log out', icon: 'log-out-outline' },
  ];

  readonly displayName = computed(() => this.auth.displayName() || 'User');

  private themeService = inject(ThemeService);
  private notificationService = inject(NotificationService);
  protected aiChat = inject(AiChatService);

  readonly themeIcon = computed(() => this.themeService.isDark() ? 'sun-outline' : 'moon-outline');
  readonly themeLabel = computed(() => this.themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode');

  onThemeToggle(): void {
    this.themeService.toggle();
  }

  private readonly MANAGER_MENU: NbMenuItem[] = [
    { title: 'Manager', group: true },
    { title: 'Overview', link: '/manager', icon: 'monitor-outline' },
    { title: 'All Tenants', link: '/manager/tenants', icon: 'grid-outline' },
    { title: 'Global Config', link: '/manager/global-config', icon: 'settings-2-outline' },
  ];

  readonly menuItems = signal<NbMenuItem[]>([]);

  constructor(
    private nbMenuService: NbMenuService,
    private sidebarService: NbSidebarService,
    private router: Router,
    protected auth: AuthService,
    private appWs: AppWsService,
  ) {
    // Reactively rebuild menu items when badge counts change
    effect(() => {
      const counts = this.notificationService.badgeCounts();
      this.menuItems.set(this._buildMenu(counts));
    });
  }

  private _buildMenu(counts: BadgeCounts): NbMenuItem[] {
    const badge = (cat: keyof BadgeCounts) =>
      counts[cat] > 0
        ? { text: String(counts[cat]), status: 'danger' }
        : undefined;

    const main: NbMenuItem[] = [
      { title: 'Home', group: true },
      { title: 'Dashboard', link: '/dashboard', icon: 'home-outline' },
      { title: 'Bookings', link: '/bookings', icon: 'calendar-outline', badge: badge('bookings') },
      { title: 'Leads', link: '/users', icon: 'people-outline', badge: badge('leads') },
      { title: 'Chats', link: '/chats', icon: 'message-circle-outline', badge: badge('chats') },

      { title: 'Content', group: true },
      { title: 'Followups', link: '/followups', icon: 'email-outline', badge: badge('followups') },
      { title: 'Templates', link: '/email-templates', icon: 'email-outline' },
      { title: 'Contents', link: '/contents', icon: 'book-open-outline' },
      { title: 'Jobs', link: '/content-jobs', icon: 'layers-outline', badge: badge('content') },
      { title: 'Blog', link: '/blog', icon: 'book-outline' },
      { title: 'Subscribers', link: '/blog/subscribers', icon: 'people-outline' },

      { title: 'Management', group: true },
      { title: 'Products', link: '/products', icon: 'cube-outline' },
      { title: 'Personas', link: '/personas', icon: 'people-outline' },
      { title: 'Offers', link: '/offers', icon: 'pricetags-outline' },
      { title: 'Courses', link: '/courses', icon: 'award-outline' },
      { title: 'Council', link: '/council/ask', icon: 'bulb-outline' },
      { title: 'Council History', link: '/council/sessions', icon: 'archive-outline' },
      { title: 'Optimization', link: '/optimization', icon: 'trending-up-outline' },
    ];

    return this.auth.isManager()
      ? [...main, ...this.MANAGER_MENU]
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
