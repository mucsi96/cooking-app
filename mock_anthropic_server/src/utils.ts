import { ClaudeMessage, ClaudeRequest } from './types';

export function getMessageContent(message: ClaudeMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('\n');
}

export function messagesMatch(
  request: ClaudeRequest,
  systemPattern: string | null,
  userPattern: string
): boolean {
  if (systemPattern && (!request.system || !request.system.includes(systemPattern))) {
    return false;
  }

  const userMessage = request.messages.find((m) => m.role === 'user');
  if (!userMessage) return false;

  const content = getMessageContent(userMessage);
  return content.includes(userPattern);
}

export function createClaudeResponse(text: string) {
  return {
    id: `msg_mock_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text,
      },
    ],
    model: 'claude-sonnet-4-5-20250514',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
  };
}
