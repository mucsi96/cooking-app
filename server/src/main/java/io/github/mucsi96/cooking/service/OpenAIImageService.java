package io.github.mucsi96.cooking.service;

import java.util.Base64;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.openai.client.OpenAIClient;
import com.openai.models.images.ImageGenerateParams;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class OpenAIImageService {

  private final OpenAIClient openAIClient;
  private final String model;

  public OpenAIImageService(
      OpenAIClient openAIClient,
      @Value("${spring.ai.openai.image.model}") String model) {
    this.openAIClient = openAIClient;
    this.model = model;
  }

  public byte[] generateImage(String prompt) {
    final ImageGenerateParams imageGenerateParams = ImageGenerateParams.builder()
        .prompt(prompt)
        .model(model)
        .size(ImageGenerateParams.Size._1024X1024)
        .quality(ImageGenerateParams.Quality.MEDIUM)
        .n(1)
        .outputFormat(ImageGenerateParams.OutputFormat.JPEG)
        .outputCompression(75)
        .build();

    return openAIClient.images().generate(imageGenerateParams).data().orElseThrow().stream()
        .flatMap(img -> img.b64Json().stream())
        .map(b64 -> Base64.getDecoder().decode(b64))
        .findFirst()
        .orElseThrow(() -> new RuntimeException("No image data returned from OpenAI API"));
  }
}
