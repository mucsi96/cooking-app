package io.github.mucsi96.cooking.model;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;

public record SelectImageRequest(
    @NotNull UUID imageId) {
}
