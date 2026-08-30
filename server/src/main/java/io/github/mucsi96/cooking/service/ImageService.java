package io.github.mucsi96.cooking.service;

import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class ImageService {

  private static final String DESCRIPTION_SYSTEM_PROMPT = """
      You are an expert prompt writer for image generation models. \
      Given the title and description of a dish, write a detailed visual description \
      of a single appetizing photorealistic food photograph of the finished dish. \
      Describe the plating, the visible ingredients, the surface it stands on, \
      the lighting and the mood. Use simple, unambiguous language an image model \
      can follow. The scene must not contain any text, letters, numbers or captions. \
      Always write the description in English, regardless of the language of the input. \
      Respond with the description only.""";

  private final ChatClient chatClient;
  private final OpenAIImageService openAIImageService;

  public ImageService(AnthropicChatModel chatModel, OpenAIImageService openAIImageService) {
    this.chatClient = ChatClient.create(chatModel);
    this.openAIImageService = openAIImageService;
  }

  public byte[] generateImage(String title, String description) {
    final String prompt = describeScene(title, description);
    return openAIImageService.generateImage(prompt);
  }

  private String describeScene(String title, String description) {
    final String scene = chatClient
        .prompt()
        .system(DESCRIPTION_SYSTEM_PROMPT)
        .user("%s%n%s".formatted(title, description))
        .call()
        .content();
    log.info("Generated image description for \"{}\": {}", title, scene);
    return scene;
  }
}
