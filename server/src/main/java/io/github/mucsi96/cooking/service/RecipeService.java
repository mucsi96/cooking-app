package io.github.mucsi96.cooking.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import org.springframework.core.task.TaskRejectedException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.cooking.entity.Ingredient;
import io.github.mucsi96.cooking.entity.ImageGenerationJob;
import io.github.mucsi96.cooking.entity.Recipe;
import io.github.mucsi96.cooking.model.CandidateImageResponse;
import io.github.mucsi96.cooking.model.ExtractedRecipe;
import io.github.mucsi96.cooking.model.ImageGenerationJobStatus;
import io.github.mucsi96.cooking.model.IngredientResponse;
import io.github.mucsi96.cooking.model.RecipeListItemResponse;
import io.github.mucsi96.cooking.model.RecipeResponse;
import io.github.mucsi96.cooking.repository.RecipeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecipeService {

  private static final int CANDIDATE_IMAGE_COUNT = 3;

  private final RecipeRepository recipeRepository;
  private final RecipeImportService recipeImportService;
  private final ImageGenerationJobService imageGenerationJobService;
  private final AsyncImageGenerationService asyncImageGenerationService;

  @Transactional(readOnly = true)
  public List<RecipeListItemResponse> listRecipes() {
    return recipeRepository.findAll().stream()
        .map(recipe -> new RecipeListItemResponse(
            recipe.getId(), recipe.getTitle(), recipe.getCategory(), recipe.getImageId()))
        .toList();
  }

  @Transactional(readOnly = true)
  public RecipeResponse getRecipe(UUID id) {
    return toResponse(findRecipe(id));
  }

  public RecipeResponse importRecipe(String text) {
    final ExtractedRecipe extracted = recipeImportService.extract(text);
    final Recipe recipe = recipeRepository.save(Recipe.builder()
        .title(extracted.title())
        .description(extracted.description())
        .category(extracted.category())
        .servings(extracted.servings())
        .createdAt(Instant.now())
        .ingredients(extracted.ingredients().stream()
            .map(ingredient -> Ingredient.builder()
                .name(ingredient.name())
                .amount(ingredient.amount())
                .unit(ingredient.unit())
                .build())
            .toList())
        .steps(extracted.steps())
        .build());
    log.info("Imported recipe \"{}\" ({})", recipe.getTitle(), recipe.getId());
    generateCandidateImages(recipe.getId());
    return toResponse(recipe);
  }

  public List<CandidateImageResponse> generateCandidateImages(UUID recipeId) {
    final Recipe recipe = findRecipe(recipeId);
    return Stream.generate(UUID::randomUUID)
        .limit(CANDIDATE_IMAGE_COUNT)
        .map(id -> {
          imageGenerationJobService.createPending(id, recipe.getId());
          try {
            asyncImageGenerationService.generate(id, recipe.getTitle(), recipe.getDescription());
          } catch (TaskRejectedException e) {
            imageGenerationJobService.markFailed(id, "Image generation queue is full");
          }
          return new CandidateImageResponse(id, ImageGenerationJobStatus.PENDING, null);
        })
        .toList();
  }

  public List<CandidateImageResponse> getCandidateImages(UUID recipeId) {
    findRecipe(recipeId);
    return imageGenerationJobService.getJobsForRecipe(recipeId).stream()
        .map(job -> new CandidateImageResponse(job.getId(), job.getStatus(), job.getError()))
        .toList();
  }

  @Transactional
  public void selectImage(UUID recipeId, UUID imageId) {
    final Recipe recipe = findRecipe(recipeId);
    final ImageGenerationJob job = imageGenerationJobService.getJob(imageId);
    if (!recipe.getId().equals(job.getRecipeId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image does not belong to this recipe");
    }
    if (job.getStatus() != ImageGenerationJobStatus.COMPLETED) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image generation is not completed");
    }
    recipe.setImageId(imageId);
    recipeRepository.save(recipe);
  }

  private Recipe findRecipe(UUID id) {
    return recipeRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipe not found"));
  }

  private RecipeResponse toResponse(Recipe recipe) {
    return new RecipeResponse(
        recipe.getId(),
        recipe.getTitle(),
        recipe.getDescription(),
        recipe.getCategory(),
        recipe.getServings(),
        recipe.getImageId(),
        recipe.getIngredients().stream()
            .map(ingredient -> new IngredientResponse(
                ingredient.getName(), ingredient.getAmount(), ingredient.getUnit()))
            .toList(),
        List.copyOf(recipe.getSteps()));
  }
}
