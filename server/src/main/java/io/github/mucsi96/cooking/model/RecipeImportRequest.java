package io.github.mucsi96.cooking.model;

import jakarta.validation.constraints.NotBlank;

public record RecipeImportRequest(
    @NotBlank String text) {
}
