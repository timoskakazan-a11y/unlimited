import { Injectable } from '@angular/core';
// Fix: Replaced non-existent `ChatCompletionStream` with `ChatCompletionChunk` which is the correct type for stream parts.
import { MLCEngine, ChatCompletionChunk, InitProgressReport } from "@mlc-ai/web-llm";
import { ChatMessage } from '../models/chat-message.model';

const SELECTED_MODEL = "Llama-3-8B-Instruct-q4f16_1-MLC";

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
    // Fix: The `reload` method signature changed. Progress callback is now set with `setInitProgressCallback` before reloading.
    this.engine.setInitProgressCallback(progressCallback);
    await this.engine.reload(SELECTED_MODEL);
  }
  
  // Fix: Updated the return type to `Promise<AsyncIterable<ChatCompletionChunk>>` which is what the streaming API returns.
  async getChatCompletionStream(messages: ChatMessage[]): Promise<AsyncIterable<ChatCompletionChunk>> {
    if (!this.engine) {
      throw new Error("Engine not initialized.");
    }
    return this.engine.chat.completions.create({
      stream: true,
      messages,
    });
  }
}