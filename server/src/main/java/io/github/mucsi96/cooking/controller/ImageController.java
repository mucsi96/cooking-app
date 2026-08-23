package io.github.mucsi96.cooking.controller;

import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import io.github.mucsi96.cooking.service.FileStorageService;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class ImageController {

  private static final String IMAGE_WEBP_VALUE = "image/webp";
  private static final MediaType IMAGE_WEBP = MediaType.parseMediaType(IMAGE_WEBP_VALUE);

  private final FileStorageService fileStorageService;

  @GetMapping(value = "/images/{id}", produces = IMAGE_WEBP_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_RecipeReader') and hasAuthority('SCOPE_readRecipes')")
  public ResponseEntity<byte[]> getImage(@PathVariable UUID id) {
    final byte[] data = fileStorageService.fetchFile("images/%s.webp".formatted(id));
    return ResponseEntity.ok()
        .contentType(IMAGE_WEBP)
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .body(data);
  }
}
