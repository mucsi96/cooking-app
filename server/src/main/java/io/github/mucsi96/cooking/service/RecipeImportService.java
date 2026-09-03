package io.github.mucsi96.cooking.service;

import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.aot.hint.annotation.RegisterReflectionForBinding;
import org.springframework.stereotype.Service;

import io.github.mucsi96.cooking.model.ExtractedRecipe;
import lombok.extern.slf4j.Slf4j;

/**
 * {@code entity(ExtractedRecipe.class)} hands the record to Spring AI's
 * {@code BeanOutputConverter}, which derives a JSON schema from it with the
 * victools generator and reads the model's answer back with a plain
 * {@code ObjectMapper}. Both work through reflection that no framework AOT
 * processing infers - the record is neither a controller payload nor an
 * entity - so in a native image the schema would come out empty and the
 * answer would not bind. {@code RegisterReflectionForBinding} registers the
 * record, its nested record and the types reachable from their components.
 */
@Service
@Slf4j
@RegisterReflectionForBinding(ExtractedRecipe.class)
public class RecipeImportService {

  private static final String SYSTEM_PROMPT = """
      You are a recipe extraction assistant. You receive the raw text of a recipe \
      pasted from an email, website or book. The text can be in any language \
      (English, German, Hungarian, ...). Extract a single structured recipe from it. \
      All output text - title, description, ingredient names, units and steps - \
      must be written in Hungarian, translating where necessary. \
      The category must be exactly one of: Reggeli, Leves, Főétel, Köret, Saláta, \
      Desszert, Sütemény, Ital, Egyéb. \
      Ingredient amounts are numbers; convert fractions to decimals and imperial \
      units to metric where practical. Leave amount and unit out for ingredients \
      like "ízlés szerint" (to taste). \
      The number of servings is an integer taken from the text; use 4 when the text \
      does not state it. \
      When the text has no description, write a short appetizing Hungarian \
      description of the dish yourself (1-2 sentences). \
      Write the steps as clear, self-contained Hungarian instructions in \
      imperative mood.""";

  private final ChatClient chatClient;

  public RecipeImportService(AnthropicChatModel chatModel) {
    this.chatClient = ChatClient.create(chatModel);
  }

  public ExtractedRecipe extract(String text) {
    log.info("Extracting structured recipe from {} characters of text", text.length());
    return chatClient
        .prompt()
        .system(SYSTEM_PROMPT)
        .user(text)
        .call()
        .entity(ExtractedRecipe.class);
  }
}
