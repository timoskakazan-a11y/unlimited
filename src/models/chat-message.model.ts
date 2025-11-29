export interface AiRole {
  name: string;
  backgroundColor: string;
  textColor: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  aiRole?: AiRole;
  isRoleChangeMessage?: boolean;
}