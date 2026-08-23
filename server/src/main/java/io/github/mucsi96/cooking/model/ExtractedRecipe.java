package io.github.mucsi96.cooking.model;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

public record ExtractedRecipe(
    @JsonPropertyDescription("Recipe title in Hungarian") String title,
    @JsonPropertyDescription("Short appetizing description in Hungarian, 1-2 sentences") String description,
    @JsonPropertyDescription("One of: Reggeli, Leves, Főétel, Köret, Saláta, Desszert, Sütemény, Ital, Egyéb") String category,
    @JsonPropertyDescription("Number of servings the ingredient amounts are for") Integer servings,
    List<ExtractedIngredient> ingredients,
    @JsonPropertyDescription("Preparation steps in Hungarian, imperative mood") List<String> steps) {

  public record ExtractedIngredient(
      @JsonPropertyDescription("Ingredient name in Hungarian") String name,
      @JsonPropertyDescription("Numeric amount, null when not applicable (e.g. to taste)") BigDecimal amount,
      @JsonPropertyDescription("Unit in Hungarian (g, dkg, kg, ml, dl, l, db, evőkanál, teáskanál, csipet), null when not applicable") String unit) {
  }
}
