import { Injectable } from '@angular/core';
import { MLCEngine, ChatCompletionChunk, InitProgressReport, ChatCompletion } from "@mlc-ai/web-llm";
import { ChatMessage } from '../models/chat-message.model';

@Injectable({ providedIn: 'root' })
export class WebLlmService {
  private engine: MLCEngine | undefined;

  async checkSupport(): Promise<boolean> {
    return !!(navigator as any).gpu;
  }

  async init(modelId: string, progressCallback: (progress: InitProgressReport) => void): Promise<void> {
    if (!this.engine) {
        this.engine = new MLCEngine();
    }
    this.engine.setInitProgressCallback(progressCallback);
    await this.engine.reload(modelId);
  }
  
  async getChatCompletionStream(messages: ChatMessage[]): Promise<AsyncIterable<ChatCompletionChunk>> {
    if (!this.engine) {
      throw new Error("Engine not initialized.");
    }
    return this.engine.chat.completions.create({
      stream: true,
      messages,
    });
  }

  async getFollowUpSuggestions(messages: ChatMessage[]): Promise<string[]> {
    if (!this.engine) {
      console.error("Suggestion engine not initialized.");
      return [];
    }
    
    try {
      const suggestionPrompt: ChatMessage = {
        role: 'user',
        content: `На основе нашего диалога, предложи 3 кратких и интересных вопроса для продолжения темы, которые мог бы задать пользователь. Верни ТОЛЬКО вопросы. Каждый вопрос на новой строке. Не используй нумерацию, маркеры или другое форматирование.`
      };

      const completion: ChatCompletion = await this.engine.chat.completions.create({
        messages: [...messages, suggestionPrompt],
        n: 1,
        temperature: 0.8,
        top_p: 0.9,
      });

      const suggestionsText = completion.choices[0]?.message?.content;

      if (suggestionsText) {
        return suggestionsText
          .split('\n')
          .map(s => s.trim().replace(/^- /,'')) // Also remove leading dashes
          .filter(s => s.length > 0 && s.endsWith('?')) // Basic validation
          .slice(0, 3);
      }

      return [];
    } catch (error) {
      console.error('Error generating follow-up suggestions:', error);
      return []; // Return empty array on failure
    }
  }

  async getPromptCompletion(partialPrompt: string): Promise<string> {
    if (!this.engine) {
      return '';
    }

    try {
      const completion: ChatCompletion = await this.engine.chat.completions.create({
        messages: [
          { role: 'system', content: `Твоя задача — дополнить фразу пользователя. Предложи короткое и логичное продолжение из 2-5 слов. Не пиши законченное предложение. Не добавляй знаки препинания в конце, если их не было в исходном тексте. Отвечай только самим дополнением, без лишних слов.` },
          { role: 'user', content: partialPrompt }
        ],
        n: 1,
        temperature: 0.5,
        max_tokens: 15, // A little more room for 5 words
        stop: ['\n', '.', '?', '!', ','] // Stop at natural sentence endings or breaks
      });

      const completionText = completion.choices[0]?.message?.content?.trim() ?? '';
      return completionText;

    } catch (error) {
      console.error('Error getting prompt completion:', error);
      return '';
    }
  }
}