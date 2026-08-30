package io.github.mucsi96.cooking.model;

import java.util.UUID;

public record CandidateImageResponse(
    UUID id,
    ImageGenerationJobStatus status,
    String error) {
}
