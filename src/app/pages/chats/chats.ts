import { Component } from '@angular/core';
import { NbChatModule } from '@nebular/theme';

@Component({
  selector: 'chats',
  imports: [NbChatModule],
  templateUrl: './chats.html',
  styleUrl: './chats.scss'
})
export class Chats {

  messages = [];

  sendMessage(event: any) {
    
  }

 
 
}
