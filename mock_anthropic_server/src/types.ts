export interface ClaudeTextBlock {
  type: 'text';
  text: string;
}

export interface ClaudeImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export type ClaudeContentBlock = ClaudeTextBlock | ClaudeImageBlock;

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: ClaudeMessage[];
}
