package io.github.mucsi96.cooking.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;

@Configuration
public class AIConfiguration {

  @Bean
  OpenAIClient openAIClient(
      @Value("${spring.ai.openai.api-key}") String apiKey,
      @Value("${spring.ai.openai.base-url:}") String baseUrl) {
    final OpenAIOkHttpClient.Builder clientBuilder = OpenAIOkHttpClient.builder().apiKey(apiKey);

    if (!baseUrl.isEmpty()) {
      clientBuilder.baseUrl(baseUrl);
    }

    return clientBuilder.build();
  }
}
