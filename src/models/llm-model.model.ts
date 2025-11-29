export interface LlmModel {
  id: string;
  name: string;
  description: string;
  performance: 'Fastest' | 'Balanced' | 'Most Capable';
}

export const AVAILABLE_MODELS: LlmModel[] = [
  {
    id: 'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC',
    name: 'Hermes 2 Pro',
    description: 'Продвинутая модель на базе Llama 3 для сложных диалогов.',
    performance: 'Most Capable',
  },
  {
    id: 'Llama-3-8B-Instruct-q4f16_1-MLC',
    name: 'Llama 3 8B',
    description: 'Самая мощная универсальная модель. Рекомендуется для мощных устройств.',
    performance: 'Most Capable',
  },
  {
    id: 'OpenHermes-2.5-Mistral-7B-q4f16_1-MLC',
    name: 'OpenHermes 2.5',
    description: 'Высокопроизводительная модель от Mistral для качественных ответов.',
    performance: 'Most Capable',
  },
  {
    id: 'Qwen2-7B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2 7B',
    description: 'Новая высокопроизводительная модель с 7B параметрами.',
    performance: 'Most Capable',
  },
  {
    id: 'CodeLlama-7b-Instruct-hf-q4f16_1-MLC',
    name: 'CodeLlama 7B',
    description: 'Специализированная модель для генерации кода и задач по программированию.',
    performance: 'Most Capable',
  },
  {
    id: 'Mistral-7B-Instruct-v0.2-q4f16_1-MLC',
    name: 'Mistral 7B',
    description: 'Популярная модель, отличная альтернатива Llama.',
    performance: 'Balanced',
  },
  {
    id: 'gemma-2b-it-q4f16_1-MLC',
    name: 'Gemma 2B',
    description: 'Сбалансированная модель от Google для общих задач.',
    performance: 'Balanced',
  },
  {
    id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
    name: 'Phi-3 Mini',
    description: 'Очень быстрая и легкая модель для менее мощных устройств.',
    performance: 'Fastest',
  },
];
