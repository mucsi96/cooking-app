package io.github.mucsi96.cooking.entity;

import java.time.Instant;
import java.util.UUID;

import io.github.mucsi96.cooking.model.ImageGenerationJobStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "image_generation_jobs", schema = "cooking")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImageGenerationJob {

  @Id
  private UUID id;

  @Column(name = "recipe_id", nullable = false)
  private UUID recipeId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ImageGenerationJobStatus status;

  @Column(columnDefinition = "text")
  private String error;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
