package io.github.mucsi96.cooking.model;

import java.util.UUID;

public record RecipeListItemResponse(
    UUID id,
    String title,
    String category,
    UUID imageId) {
}
