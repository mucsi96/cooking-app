package io.github.mucsi96.cooking.service;

import java.util.UUID;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncImageGenerationService {

  private static final int MAX_IMAGE_DIMENSION = 1200;

  private final ImageService imageService;
  private final FfmpegService ffmpegService;
  private final FileStorageService fileStorageService;
  private final ImageGenerationJobService imageGenerationJobService;

  @Async("imageGenerationExecutor")
  public void generate(UUID id, String title, String description) {
    try {
      final byte[] image = imageService.generateImage(title, description);
      final String filePath = "images/%s.webp".formatted(id);
      ffmpegService.resizeImage(
          image, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION,
          fileStorageService.resolveFilePath(filePath));
      imageGenerationJobService.markCompleted(id);
    } catch (Exception e) {
      log.error("Image generation job {} failed", id, e);
      imageGenerationJobService.markFailed(id, "Image generation failed");
    }
  }
}
