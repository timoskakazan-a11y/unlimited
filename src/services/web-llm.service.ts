import { Injectable } from '@angular/core';
import { MLCEngine, ChatCompletionStream, InitProgressReport } from "@mlc-ai/web-llm";
import { ChatMessage } from '../models/chat-message.model';

const SELECTED_MODEL = "gemma-2b-it-q4f16_1-MLC";

@Injectable({ providedIn: 'root' })
export class WebLlmService {
  private engine: MLCEngine | undefined;

  async checkSupport(): Promise<boolean> {
    // Use the standard browser API to check for WebGPU support, as the library's internal method is unstable.
    // Fix: Cast navigator to 'any' to access the 'gpu' property, which is not in the default TS DOM typings.
    return !!(navigator as any).gpu;
  }

  async init(progressCallback: (progress: InitProgressReport) => void): Promise<void> {
    if (!this.engine) {
        this.engine = new MLCEngine();
    }
    await this.engine.reload(SELECTED_MODEL, undefined, progressCallback);
  }
  
  async getChatCompletionStream(messages: ChatMessage[]): Promise<ChatCompletionStream> {
    if (!this.engine) {
      throw new Error("Engine not initialized.");
    }
    return this.engine.chat.completions.create({
      stream: true,
      messages,
    });
  }
}
