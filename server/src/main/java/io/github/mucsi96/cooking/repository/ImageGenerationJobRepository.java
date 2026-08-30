package io.github.mucsi96.cooking.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.mucsi96.cooking.entity.ImageGenerationJob;
import io.github.mucsi96.cooking.model.ImageGenerationJobStatus;

public interface ImageGenerationJobRepository extends JpaRepository<ImageGenerationJob, UUID> {

  List<ImageGenerationJob> findByRecipeIdOrderByCreatedAt(UUID recipeId);

  @Modifying
  @Query("update ImageGenerationJob j set j.status = :status, j.error = :error where j.id = :id")
  void updateStatus(
      @Param("id") UUID id,
      @Param("status") ImageGenerationJobStatus status,
      @Param("error") String error);
}
