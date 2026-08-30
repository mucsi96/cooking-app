package io.github.mucsi96.cooking.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.cooking.entity.ImageGenerationJob;
import io.github.mucsi96.cooking.model.ImageGenerationJobStatus;
import io.github.mucsi96.cooking.repository.ImageGenerationJobRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ImageGenerationJobService {

  private final ImageGenerationJobRepository imageGenerationJobRepository;

  @Transactional
  public ImageGenerationJob createPending(UUID id, UUID recipeId) {
    return imageGenerationJobRepository.save(ImageGenerationJob.builder()
        .id(id)
        .recipeId(recipeId)
        .status(ImageGenerationJobStatus.PENDING)
        .createdAt(Instant.now())
        .build());
  }

  @Transactional
  public void markCompleted(UUID id) {
    imageGenerationJobRepository.updateStatus(id, ImageGenerationJobStatus.COMPLETED, null);
  }

  @Transactional
  public void markFailed(UUID id, String error) {
    imageGenerationJobRepository.updateStatus(id, ImageGenerationJobStatus.FAILED, error);
  }

  @Transactional(readOnly = true)
  public ImageGenerationJob getJob(UUID id) {
    return imageGenerationJobRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Image generation job not found"));
  }

  @Transactional(readOnly = true)
  public List<ImageGenerationJob> getJobsForRecipe(UUID recipeId) {
    return imageGenerationJobRepository.findByRecipeIdOrderByCreatedAt(recipeId);
  }
}
