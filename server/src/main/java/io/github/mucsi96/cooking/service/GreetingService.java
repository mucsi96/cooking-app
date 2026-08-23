package io.github.mucsi96.cooking.service;

import java.util.List;

import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Service;

import io.github.mucsi96.cooking.entity.Greeting;
import io.github.mucsi96.cooking.model.GreetingResponse;
import io.github.mucsi96.cooking.repository.GreetingRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GreetingService {
  private final GreetingRepository greetingRepository;
  private final AnthropicChatModel chatModel;

  public GreetingResponse getGreeting() {
    Greeting greeting = greetingRepository.findAll().stream()
        .findFirst()
        .orElseThrow(() -> new RuntimeException("No greeting found in database"));

    String aiGreeting = generateAiGreeting(greeting.getName(), greeting.getMessage());

    return new GreetingResponse(greeting.getName(), greeting.getMessage(), aiGreeting);
  }

  private String generateAiGreeting(String name, String message) {
    Prompt prompt = new Prompt(List.of(
        new SystemMessage("You are a friendly assistant. Generate a short, warm greeting."),
        new UserMessage("Greet " + name + " with the following context: " + message)));

    return chatModel.call(prompt).getResult().getOutput().getText();
  }
}
