package io.github.mucsi96.cooking.entity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "recipes", schema = "cooking")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Recipe {

  @Id
  @GeneratedValue
  private UUID id;

  @Column(nullable = false)
  private String title;

  @Column(nullable = false, columnDefinition = "text")
  private String description;

  @Column(nullable = false)
  private String category;

  @Column(nullable = false)
  private int servings;

  @Column(name = "image_id")
  private UUID imageId;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @ElementCollection
  @CollectionTable(name = "recipe_ingredients", schema = "cooking", joinColumns = @JoinColumn(name = "recipe_id"))
  @OrderColumn(name = "position")
  private List<Ingredient> ingredients;

  @ElementCollection
  @CollectionTable(name = "recipe_steps", schema = "cooking", joinColumns = @JoinColumn(name = "recipe_id"))
  @OrderColumn(name = "position")
  @Column(name = "step", nullable = false, columnDefinition = "text")
  private List<String> steps;
}
