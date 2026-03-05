import { Component, input, output, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EditorComponent } from 'ngx-monaco-editor-v2';

@Component({
  selector: 'app-code-editor',
  standalone: true,
  imports: [FormsModule, EditorComponent],
  template: `
    <ngx-monaco-editor
      [options]="editorOptions"
      [ngModel]="innerValue()"
      (ngModelChange)="onModelChange($event)"
      class="monaco-host"
    ></ngx-monaco-editor>
  `,
  styles: [`
    :host {
      display: block;
      margin-top: 0.5rem;
    }
    .monaco-host {
      height: 400px;
      border: 1px solid var(--v-input-border);
      border-radius: 8px;
      overflow: hidden;
    }
  `],
})
export class CodeEditorComponent {
  readonly value = input<string>('');
  readonly valueChange = output<string>();

  readonly innerValue = signal('');
  private skipEmit = false;

  editorOptions = {
    theme: 'vs-dark',
    language: 'html',
    automaticLayout: true,
    wordWrap: 'on' as const,
    fontSize: 13,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    tabSize: 2,
  };

  constructor() {
    effect(() => {
      const v = this.value();
      if (!this.skipEmit) {
        this.innerValue.set(v);
      }
      this.skipEmit = false;
    });
  }

  onModelChange(val: string) {
    this.skipEmit = true;
    this.innerValue.set(val);
    this.valueChange.emit(val);
  }
}
