import { Component, Input, OnInit, inject} from '@angular/core';
import { User } from '../../libs/model/user';
import { UserService } from '../../libs/service/user.service';
import { UserServiceMock } from '../../libs/service/mock/user.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { Tag } from 'primeng/tag';


@Component({
  selector: 'users',
  imports: [TableModule, CommonModule, InputTextModule, Tag, IconField, InputIcon],
  templateUrl: './users.html',
  styleUrl: './users.scss' 
})
export class Users {
  private userService = inject(UserServiceMock);

  // expose signals directly to template
  users = this.userService.users; // WritableSignal<User[]>
  loading = this.userService.loading;
  error = this.userService.error;

  selectedUser: User | null = null;

  globalFilterFields = [
    'id',
    'name',
    'email',
    'phone',
    'utm_persona',
    'chat_state',
  ];

  // actions call service methods
  async remove(user: User) {
    if (!confirm(`Remove user ${user.name ?? user.id}?`)) return;
    await this.userService.removeUserById(user.id);
  }

  tableDt = {
    header: {
      background: '#00b3c6',    // turquoise header
      textColor: '#ffffff'
    },
    row: {
      hoverBackground: '#00b3c622', // translucent turquoise on hover
      selectedBackground: '#00b3c88a'
    },
    paginator: {
      background: '#00b3c6',
      textColor: '#ffffff'
    }
  };


  async syncToBackend(user: User) {
    const updated: User = {
      ...user,
      prev_chat_state: user.chat_state ?? user.prev_chat_state ?? null,
      chat_state: 'synced',
    };
    await this.userService.upsertUser(updated);
    // replace with toast in prod
    alert(`User ${user.id} synced.`);
  }

  getSeverityByChatState(state?: string): string {
    switch ((state || '').toLowerCase()) {
      case 'active':
      case 'synced':
        return 'success';
      case 'onboarding':
        return 'info';
      case 'idle':
        return 'warning';
      case 'blocked':
      case 'suspended':
        return 'danger';
      default:
        return 'info';
    }
 
}}
 


