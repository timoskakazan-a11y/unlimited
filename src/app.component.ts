import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  ViewChild,
  ElementRef,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WebLlmService } from './services/web-llm.service';
import { ChatMessage } from './models/chat-message.model';
import { InitProgressReport } from '@mlc-ai/web-llm';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class AppComponent {
  private webLlmService = inject(WebLlmService);

  @ViewChild('chatContainer') private chatContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('promptInput') private promptInput!: ElementRef<HTMLTextAreaElement>;

  engineState = signal<'initial' | 'loading' | 'ready' | 'error'>('initial');
  initProgressReport = signal<InitProgressReport | null>(null);
  messages = signal<ChatMessage[]>([]);
  currentPrompt = signal('');
  isLoading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    effect(() => {
      // Scroll to bottom when new messages are added
      if (this.messages()) {
        this.scrollToBottom();
      }
    });
    effect(() => {
        // Auto-resize textarea when prompt changes
        if (this.currentPrompt() !== undefined) {
            this.autoResizeTextarea();
        }
    })
  }
  
  async initModel() {
    this.engineState.set('loading');
    try {
      const supported = await this.webLlmService.checkSupport();
      if (!supported) {
        throw new Error("Ваш браузер не поддерживает WebGPU. Пожалуйста, используйте последнюю версию Chrome или Edge.");
      }
      await this.webLlmService.init((progress) => {
        this.initProgressReport.set(progress);
      });
      this.engineState.set('ready');
    } catch(e: any) {
      this.error.set(e.message);
      this.engineState.set('error');
      console.error(e);
    }
  }


  async handleSendMessage(): Promise<void> {
    const prompt = this.currentPrompt().trim();
    if (!prompt || this.isLoading()) return;

    this.isLoading.set(true);
    this.error.set(null);
    const userMessage: ChatMessage = { role: 'user', content: prompt };
    this.messages.update((m) => [...m, userMessage]);
    this.currentPrompt.set('');
    
    this.autoResizeTextarea();

    // Add a placeholder for the AI's streaming response
    this.messages.update((m) => [...m, { role: 'assistant', content: '' }]);

    try {
      const stream = await this.webLlmService.getChatCompletionStream(this.messages());
      
      let lastMessageIndex = this.messages().length - 1;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
             this.messages.update((currentMessages) => {
              const newMessages = [...currentMessages];
              if (newMessages[lastMessageIndex]) {
                newMessages[lastMessageIndex].content += delta;
              }
              return newMessages;
            });
        }
      }

    } catch (e: any) {
      this.error.set('Произошла ошибка при общении с AI. Пожалуйста, попробуйте еще раз.');
      console.error(e);
      // Remove the empty placeholder on error
      this.messages.update(m => m.filter(msg => msg.content !== '' || msg.role !== 'assistant'));
    } finally {
      this.isLoading.set(false);
      this.focusInput();
    }
  }

  onInput(): void {
    this.autoResizeTextarea();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.handleSendMessage();
    }
  }

  public parseMarkdown(text: string): string {
    if (!text) return '';

    const inlineParse = (line: string): string => {
        return line
            .replace(/==(.*?)==/g, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    };

    const lines = text.split('\n');
    let html = '';
    let inList = false;

    for (const line of lines) {
        // Headers
        if (line.match(/^###\s*/)) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h3 class="text-xl font-semibold mb-2 mt-4">${inlineParse(line.replace(/^###\s*/, ''))}</h3>`;
            continue;
        }
        if (line.match(/^##\s*/)) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h2 class="text-2xl font-bold mb-3 mt-5">${inlineParse(line.replace(/^##\s*/, ''))}</h2>`;
            continue;
        }
        if (line.match(/^#\s*/)) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h1 class="text-3xl font-bold mb-4 mt-6">${inlineParse(line.replace(/^#\s*/, ''))}</h1>`;
            continue;
        }
        // Horizontal Rule
        if (line.trim() === '---') {
            if (inList) { html += '</ul>'; inList = false; }
            html += '<hr class="my-4 border-gray-300/80">';
            continue;
        }
        // List items
        if (line.match(/^\*\s*/)) {
            if (!inList) {
                html += '<ul class="space-y-2 my-3">';
                inList = true;
            }
            html += `<li class="flex items-start"><span class="mr-3 mt-2 block w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0"></span><span>${inlineParse(line.replace(/^\*\s*/, ''))}</span></li>`;
            continue;
        }

        // If we are in a list and the line is not a list item, end the list.
        if (inList) {
            html += '</ul>';
            inList = false;
        }
        
        // Paragraph
        if (line.trim() !== '') {
            html += `<p class="leading-relaxed my-2">${inlineParse(line)}</p>`;
        }
    }

    if (inList) {
        html += '</ul>';
    }

    return html;
  }

  private autoResizeTextarea = (): void => {
    setTimeout(() => {
        const textarea = this.promptInput?.nativeElement;
        if(textarea) {
            textarea.style.height = 'auto'; // Reset height
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, 0)
  }

  private scrollToBottom = (): void => {
    setTimeout(() => {
      if (this.chatContainer?.nativeElement) {
        this.chatContainer.nativeElement.scrollTo({
          top: this.chatContainer.nativeElement.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  }

  private focusInput = (): void => {
    setTimeout(() => {
        this.promptInput?.nativeElement?.focus();
    }, 0);
  }
}
