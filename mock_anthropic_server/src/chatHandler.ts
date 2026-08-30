import { ClaudeRequest } from './types';
import { createClaudeResponse, getMessageContent } from './utils';
import { GOULASH, STRUDEL } from './data';

export class ChatHandler {
  processRequest(request: ClaudeRequest) {
    const userMessage = request.messages.find((m) => m.role === 'user');
    if (!userMessage) {
      throw new Error('No user message found');
    }

    const system =
      typeof request.system === 'string'
        ? request.system
        : (request.system ?? [])
            .map((block) => ('text' in block ? block.text : ''))
            .join('\n');
    const content = getMessageContent(userMessage);

    // Structured recipe extraction: respond with JSON only, as the
    // BeanOutputConverter format instructions demand.
    if (system.includes('recipe extraction assistant')) {
      if (content.includes('Goulash') || content.includes('goulash')) {
        return createClaudeResponse(JSON.stringify(GOULASH));
      }
      if (content.includes('Apfelstrudel')) {
        return createClaudeResponse(JSON.stringify(STRUDEL));
      }
      return createClaudeResponse(JSON.stringify(GOULASH));
    }

    // Image scene description for thumbnail generation
    if (system.includes('photorealistic food photograph')) {
      const dish = content.split('\n')[0];
      return createClaudeResponse(
        `A photorealistic photo of freshly cooked ${dish} served in a rustic bowl on a wooden table, warm natural light, no text.`
      );
    }

    return createClaudeResponse(
      'Hello! I received your message. How can I help you today?'
    );
  }
}
