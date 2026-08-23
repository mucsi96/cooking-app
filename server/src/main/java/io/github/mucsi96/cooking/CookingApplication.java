package io.github.mucsi96.cooking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import io.github.mucsi96.cooking.config.DatabaseStartupInitializer;

@SpringBootApplication
public class CookingApplication {

  public static void main(String[] args) {
    final SpringApplication app = new SpringApplication(CookingApplication.class);
    app.addInitializers(new DatabaseStartupInitializer());
    app.run(args);
  }
}
