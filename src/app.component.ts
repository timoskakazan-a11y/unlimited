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
import { ChatMessage, AiRole } from './models/chat-message.model';
import { InitProgressReport } from '@mlc-ai/web-llm';
import { LlmModel, AVAILABLE_MODELS } from './models/llm-model.model';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GeminiService } from './services/gemini.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class AppComponent {
  private webLlmService = inject(WebLlmService);
  private geminiService = inject(GeminiService);
  private destroyRef = inject(ElementRef);

  @ViewChild('chatContainer') private chatContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('promptInput') private promptInput!: ElementRef<HTMLTextAreaElement>;

  engineState = signal<'initial' | 'loading' | 'ready' | 'error'>('initial');
  initProgressReport = signal<InitProgressReport | null>(null);
  messages = signal<ChatMessage[]>([]);
  currentPrompt = signal('');
  isLoading = signal(false);
  error = signal<string | null>(null);
  suggestedPrompts = signal<string[]>([]);
  promptSuggestion = signal<string>('');

  availableModels = signal<LlmModel[]>(AVAILABLE_MODELS);
  selectedModel = signal<LlmModel | null>(this.availableModels()[0]); 
  loadedModelName = signal<string>('');
  
  private promptChanged = new Subject<string>();
  
  // Role management state
  readonly DEFAULT_ROLE: AiRole = { name: 'Assistant', backgroundColor: '#F1F5F9', textColor: '#475569' };
  currentAiRole = signal<AiRole>(this.DEFAULT_ROLE);
  private assignedRoles = signal<Map<string, AiRole>>(new Map());
  private readonly roleColors: readonly string[][] = [
    ['#DBEAFE', '#1E40AF'], // Blue
    ['#D1FAE5', '#065F46'], // Green
    ['#FEE2E2', '#991B1B'], // Red
    ['#FEF3C7', '#92400E'], // Amber
    ['#E0E7FF', '#3730A3'], // Indigo
    ['#FCE7F3', '#9D266B'], // Pink
    ['#E9D5FF', '#581C87'], // Purple
  ];
  private nextColorIndex = 0;

  readonly RUSSIAN_SYSTEM_PROMPT: ChatMessage = {
    role: 'system',
    content: `Ты — ИИ-ассистент, который общается исключительно на русском языке.
ЗАДАЧА: Твоя главная задача — давать чёткие, грамотные и полезные ответы на русском языке.

ПРАВИЛА ОБЩЕНИЯ:
1.  **ТОЛЬКО РУССКИЙ ЯЗЫК:** Ты должен использовать только кириллицу. Категорически запрещено использовать латиницу, арабские символы, иероглифы или любые другие символы, не относящиеся к русскому языку.
2.  **БЕЗ "МУСОРА":** Запрещено генерировать бессмысленный текст, случайные символы, технические токены (например, 'btteINE', '_FR2otype') или любой другой "мусорный" вывод.
3.  **ГРАМОТНОСТЬ:** Твои ответы должны быть безупречно грамотными с точки зрения орфографии, пунктуации и стилистики русского языка.
4.  **КРАТКОСТЬ И СУЩЕСТВО:** Отвечай по делу, без лишней "воды".

ПРАВИЛА ФОРМАТИРОВАНИЯ:
Для улучшения читаемости ты можешь использовать следующие элементы Markdown:
- **Заголовки:** Используй \`## \` для основного заголовка и \`### \` для подзаголовков.
- **Списки:** Начинай каждый пункт списка с \`- \`.
- **Выделение:** Используй \`**жирный текст**\` для выделения ключевых моментов и \`*курсив*\` для акцентов.

**ОСОБОЕ ПРАВИЛО ДЛЯ ССЫЛОК (ОЧЕНЬ ВАЖНО):**
- Если ты хочешь предложить пользователю веб-сайт, ты ОБЯЗАН использовать специальный формат.
- **НЕПРАВИЛЬНО:** Просто вставлять ссылку \`https://example.com\` или использовать обычный Markdown \`[название сайта](https://example.com)\`.
- **ПРАВИЛЬНО:** Используй СТРОГО следующий формат: \`[PREVIEW](https://example.com)\`.
- **ПРИМЕР:** Чтобы порекомендовать сайт о кулинарии, твой ответ должен выглядеть так:
  \`Я нашел отличный сайт с рецептами: [PREVIEW](https://www.povarenok.ru)\`
- Я автоматически превращу эту специальную ссылку в красивую интерактивную карточку с превью сайта. Это единственный допустимый способ добавлять ссылки.

Применяй форматирование осмысленно, чтобы структурировать ответ. Нарушение этих правил недопустимо. Твой ответ должен быть чистым и полностью на русском языке.`
  };


  constructor() {
    effect(() => {
      if (this.messages()) {
        this.scrollToBottom();
      }
    });
    effect(() => {
        if (this.currentPrompt() !== undefined) {
            this.autoResizeTextarea();
        }
    });

    this.promptChanged.pipe(
        debounceTime(500), // 500ms debounce time
        takeUntilDestroyed()
    ).subscribe(async (prompt) => {
        // Only trigger if prompt is long enough, not loading, and no suggestion exists
        if (prompt.length >= 10 && !this.isLoading() && !this.promptSuggestion()) {
            const completion = await this.webLlmService.getPromptCompletion(prompt);
            // Ensure prompt hasn't changed while waiting for completion
            if (this.currentPrompt() === prompt) {
                this.promptSuggestion.set(completion);
            }
        } else if (prompt.length < 10) {
            this.promptSuggestion.set(''); // Clear if prompt becomes too short
        }
    });
  }
  
  selectModel(model: LlmModel): void {
    this.selectedModel.set(model);
  }
  
  async initModel() {
    const model = this.selectedModel();
    if (!model) {
      this.error.set("Please select a model to load.");
      this.engineState.set('error');
      return;
    }

    this.messages.set([]);
    this.suggestedPrompts.set([]);
    
    this.engineState.set('loading');
    this.error.set(null);

    try {
      const supported = await this.webLlmService.checkSupport();
      if (!supported) {
        throw new Error("Your browser does not support WebGPU. Please use the latest version of Chrome or Edge.");
      }
      await this.webLlmService.init(model.id, (progress) => {
        this.initProgressReport.set(progress);
      });
      this.loadedModelName.set(model.name);
      this.engineState.set('ready');
      this.currentAiRole.set(this.DEFAULT_ROLE); // Reset role
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
    this.suggestedPrompts.set([]);
    this.promptSuggestion.set('');
    
    const userMessage: ChatMessage = { role: 'user', content: prompt };
    this.messages.update((m) => [...m, userMessage]);
    this.currentPrompt.set('');
    this.autoResizeTextarea();

    let roleChanged = false;
    try {
      const roleInfo = await this.geminiService.detectRole(prompt);
      if (roleInfo && roleInfo.isRoleChange && roleInfo.role) {
        this.currentAiRole.set(this.getOrCreateRole(roleInfo.role));
        roleChanged = true;
      }
    } catch(e) {
      console.error("Role detection failed:", e);
    }
    
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      aiRole: this.currentAiRole(),
      isRoleChangeMessage: roleChanged,
    };
    this.messages.update((m) => [...m, assistantMessage]);
    const lastMessageIndex = this.messages().length - 1;

    const messagesForApi: ChatMessage[] = [this.RUSSIAN_SYSTEM_PROMPT, ...this.messages()];
    
    try {
      const stream = await this.webLlmService.getChatCompletionStream(messagesForApi);
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          await this.typeText(delta, lastMessageIndex);
        }
      }

      // Generate suggestions once the main response is complete
      if (this.messages().at(-1)?.content) { // Ensure there is content
        const suggestions = await this.webLlmService.getFollowUpSuggestions([this.RUSSIAN_SYSTEM_PROMPT, ...this.messages()]);
        this.suggestedPrompts.set(suggestions);
      }

    } catch (e: any) {
      this.error.set('An error occurred while communicating with the AI. Please try again.');
      console.error(e);
      this.messages.update(m => {
        const last = m[m.length-1];
        if (last && last.role === 'assistant' && last.content === '') {
          return m.slice(0, -1);
        }
        return m;
      });
    } finally {
      this.isLoading.set(false);
      this.focusInput();
    }
  }

  sendSuggestedPrompt(prompt: string): void {
    this.currentPrompt.set(prompt);
    // Use a timeout to allow the prompt to update before sending
    setTimeout(() => this.handleSendMessage(), 0);
  }

  public parseMarkdown(text: string): string {
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 1. Link Previews: [PREVIEW](https://...)
    html = html.replace(/\[PREVIEW\]\((https?:\/\/[^\s)]+)\)/g, (match, url) => {
      return this.createLinkPreview(url);
    });

    // 2. Block elements: Headings and Lists
    html = html.replace(/((?:^- .*(?:\n|$))+)/gm, (match) => {
      const items = match.trim().split('\n');
      const listItems = items.map(item => {
        let content = item.substring(2).trim();
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
        return `<li>${content}</li>`;
      }).join('');
      return `<ul>${listItems}</ul>`;
    });
    
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');

    // 3. Inline elements (for lines that are not part of a list)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // 4. Paragraphs and newlines
    return html.split('\n').map(line => {
      if (line.trim().startsWith('<') && line.trim().endsWith('>')) {
        return line; // It's likely an HTML block we already processed
      }
      return line.trim() === '' ? '<br>' : `<p>${line}</p>`;
    }).join('');
  }

  private createLinkPreview(url: string): string {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain_url=${domain}`;

        const safeUrl = url.replace(/"/g, "&quot;");
        const safeDomain = domain.replace(/</g, "&lt;");
        const safeDisplayUrl = url.replace(/</g, "&lt;");

        return `
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="link-preview-card">
                <img src="${faviconUrl}" alt="Favicon" class="link-preview-favicon" />
                <div class="link-preview-info">
                    <span class="link-preview-title">${safeDomain}</span>
                    <span class="link-preview-url">${safeDisplayUrl}</span>
                </div>
            </a>
        `;
    } catch (e) {
        const safeUrl = url.replace(/</g, "&lt;").replace(/"/g, "&quot;");
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`;
    }
  }

  acceptSuggestion(): void {
    if (this.promptSuggestion()) {
      this.currentPrompt.update(p => p + this.promptSuggestion());
      this.promptSuggestion.set('');
      this.autoResizeTextarea();
      this.focusInput();
    }
  }

  onInput(): void {
    this.autoResizeTextarea();
    // Clear any existing suggestion as the user is typing again
    if (this.promptSuggestion()) {
      this.promptSuggestion.set('');
    }
    this.promptChanged.next(this.currentPrompt());
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.key === 'Tab' || event.key === 'ArrowRight') && this.promptSuggestion()) {
        const input = event.target as HTMLTextAreaElement;
        // Only complete if the cursor is at the end of the text
        if (input.selectionStart === this.currentPrompt().length && input.selectionEnd === this.currentPrompt().length) {
            event.preventDefault();
            this.acceptSuggestion();
        }
    } else if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (this.promptSuggestion()) {
            this.promptSuggestion.set('');
        }
        this.handleSendMessage();
    }
  }

  private getOrCreateRole(roleName: string): AiRole {
    const normalizedRole = roleName.trim();
    if (this.assignedRoles().has(normalizedRole)) {
      return this.assignedRoles().get(normalizedRole)!;
    }
    
    const [backgroundColor, textColor] = this.roleColors[this.nextColorIndex];
    this.nextColorIndex = (this.nextColorIndex + 1) % this.roleColors.length;

    const newRole: AiRole = { name: normalizedRole, backgroundColor, textColor };
    this.assignedRoles.update(map => new Map(map).set(normalizedRole, newRole));
    return newRole;
  }

  // Smoothly "types" text character by character for a better user experience
  private async typeText(text: string, messageIndex: number) {
    for (const char of text) {
        this.messages.update((currentMessages) => {
            const newMessages = [...currentMessages];
            if (newMessages[messageIndex]) {
                newMessages[messageIndex].content += char;
            }
            return newMessages;
        });
        await new Promise(resolve => setTimeout(resolve, 5)); // 5ms delay for fast typing
    }
  }

  private autoResizeTextarea = (): void => {
    setTimeout(() => {
        const textarea = this.promptInput?.nativeElement;
        if(textarea) {
            textarea.style.height = 'auto';
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