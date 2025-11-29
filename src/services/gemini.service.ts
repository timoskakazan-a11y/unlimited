import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from "@google/genai";

export interface AiRoleInfo {
    isRoleChange: boolean;
    role: string | null;
}

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY environment variable not set.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async detectRole(prompt: string): Promise<AiRoleInfo> {
    try {
      const systemInstruction = `Your task is to analyze a user's prompt and determine if they are assigning a new role to the AI.
      Keywords to look for: "act as", "you are a", "be a", "ты -", "представь, что ты", "расскажи как", "объясни как".
      If a role is assigned, extract the role. The role should be a single noun, capitalized, in Russian. For example, if the prompt is "act as a professional chef", the role is "Шеф-повар". If the prompt is "ты юрист", the role is "Юрист".
      Respond with a JSON object following this schema: { "isRoleChange": boolean, "role": string | null }.
      If no role is detected, "isRoleChange" should be false and "role" should be null.
      Examples:
      - Prompt: "ты опытный юрист. расскажи о..." -> Response: { "isRoleChange": true, "role": "Юрист" }
      - Prompt: "расскажи как шеф-повар как приготовить борщ" -> Response: { "isRoleChange": true, "role": "Шеф-повар" }
      - Prompt: "какая сегодня погода?" -> Response: { "isRoleChange": false, "role": null }
      `;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    isRoleChange: { type: Type.BOOLEAN },
                    role: { type: Type.STRING }
                },
                required: ['isRoleChange']
            }
        }
      });

      const jsonText = response.text.trim();
      const result = JSON.parse(jsonText);

      // Validate the result
      if (typeof result.isRoleChange === 'boolean') {
        return {
          isRoleChange: result.isRoleChange,
          role: result.isRoleChange && typeof result.role === 'string' ? result.role : null
        };
      }
      return { isRoleChange: false, role: null };
    } catch (error) {
      console.error('Error detecting role:', error);
      return { isRoleChange: false, role: null }; // Return default on failure
    }
  }
}