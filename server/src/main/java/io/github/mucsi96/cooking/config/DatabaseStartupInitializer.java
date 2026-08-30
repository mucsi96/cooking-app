package io.github.mucsi96.cooking.config;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Arrays;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class DatabaseStartupInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        final ConfigurableEnvironment environment = applicationContext.getEnvironment();

        if (Arrays.asList(environment.getActiveProfiles()).contains("local")) {
            startDatabase();
        }
    }

    private void startDatabase() {
        final Path scriptPath = Path.of(System.getProperty("user.dir"), "..", "scripts", "dev_db_up.sh")
                .toAbsolutePath().normalize();
        log.info("Starting development database using {}", scriptPath);

        try {
            final ProcessBuilder pb = new ProcessBuilder("bash", scriptPath.toString());
            pb.inheritIO();
            final int exitCode = pb.start().waitFor();
            if (exitCode != 0) {
                throw new IllegalStateException("dev_db_up.sh failed with exit code " + exitCode);
            }
        } catch (IOException | InterruptedException e) {
            throw new IllegalStateException("Failed to start development database", e);
        }
    }
}
