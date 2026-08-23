import { ClaudeRequest } from './types';
import { createClaudeResponse, getMessageContent } from './utils';

export class ChatHandler {
  processRequest(request: ClaudeRequest) {
    const userMessage = request.messages.find((m) => m.role === 'user');
    if (!userMessage) {
      throw new Error('No user message found');
    }

    const content = getMessageContent(userMessage);

    // Match greeting requests
    if (content.toLowerCase().includes('greet')) {
      const nameMatch = content.match(/Greet (\w+)/i);
      const name = nameMatch ? nameMatch[1] : 'friend';
      return createClaudeResponse(
        `Hello ${name}! It's wonderful to see you today. I hope you're having a fantastic day!`
      );
    }

    return createClaudeResponse(
      'Hello! I received your message. How can I help you today?'
    );
  }
}
