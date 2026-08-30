package io.github.mucsi96.cooking.model;

import java.util.List;
import java.util.UUID;

public record RecipeResponse(
    UUID id,
    String title,
    String description,
    String category,
    int servings,
    UUID imageId,
    List<IngredientResponse> ingredients,
    List<String> steps) {
}
