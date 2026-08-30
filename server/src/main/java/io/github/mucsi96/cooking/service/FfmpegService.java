package io.github.mucsi96.cooking.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class FfmpegService {

  private static final int TIMEOUT_SECONDS = 30;
  private static final String INPUT = "__INPUT__";

  public void resizeImage(byte[] imageData, int width, int height, Path outputFile) throws IOException {
    Files.createDirectories(outputFile.getParent());
    run(imageData,
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", INPUT,
        "-filter:v", "scale=%d:%d:force_original_aspect_ratio=decrease".formatted(width, height),
        "-codec:v", "libwebp", "-quality", "75",
        "-frames:v", "1",
        "-f", "webp",
        outputFile.toString());
  }

  private void run(byte[] input, String... args) throws IOException {
    final Path inputFile = Files.createTempFile("ffmpeg-in-", ".tmp");
    try {
      Files.write(inputFile, input);
      final ProcessBuilder pb = new ProcessBuilder(
          Arrays.stream(args)
              .map(a -> a.equals(INPUT) ? inputFile.toString() : a)
              .toList());
      pb.redirectErrorStream(true);
      log.debug("Running ffmpeg: {}", String.join(" ", pb.command()));
      final Process process = pb.start();

      try {
        final boolean finished = process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);

        if (!finished) {
          process.destroyForcibly();
          throw new IOException("ffmpeg timed out after %d seconds".formatted(TIMEOUT_SECONDS));
        }

        final byte[] output = process.getInputStream().readAllBytes();

        if (process.exitValue() != 0) {
          throw new IOException("ffmpeg exited with code %d: %s".formatted(
              process.exitValue(), new String(output, StandardCharsets.UTF_8)));
        }
      } catch (InterruptedException e) {
        process.destroyForcibly();
        Thread.currentThread().interrupt();
        throw new IOException("ffmpeg process interrupted", e);
      }
    } finally {
      Files.deleteIfExists(inputFile);
    }
  }
}
