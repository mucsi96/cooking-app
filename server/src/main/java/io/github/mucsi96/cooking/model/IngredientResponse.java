package io.github.mucsi96.cooking.model;

import java.math.BigDecimal;

public record IngredientResponse(
    String name,
    BigDecimal amount,
    String unit) {
}
