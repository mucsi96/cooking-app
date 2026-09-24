import { ClaudeRequest } from './types';
import { createClaudeResponse, getMessageContent, hasImageContent } from './utils';
import { GOULASH, STRUDEL } from './data';

export class ChatHandler {
  processRequest(request: ClaudeRequest) {
    if (request.output_config?.format?.type !== 'json_schema' || !request.output_config.format.schema) {
      throw new Error('A structured output schema is required');
    }
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

    // Structured recipe extraction uses the same JSON contract as the Go client.
    if (system.includes('recipe extraction assistant')) {
      if (content.includes('FENCED_JSON')) {
        return createClaudeResponse('```json\n' + JSON.stringify(GOULASH) + '\n```');
      }
      if (content.includes('INVALID_JSON')) {
        return createClaudeResponse('```json\n{"title":\n```');
      }
      if (content.includes('visible in this photo') && !hasImageContent(userMessage)) {
        throw new Error('Recipe photo is missing from the user message');
      }
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
        JSON.stringify({ description: `A photorealistic photo of freshly cooked ${dish} served in a rustic bowl on a wooden table, warm natural light, no text.` })
      );
    }

    throw new Error('Unknown structured output operation');
  }
}
