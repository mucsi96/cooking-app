package io.github.mucsi96.cooking.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import io.github.mucsi96.cooking.model.CandidateImageResponse;
import io.github.mucsi96.cooking.model.RecipeImportRequest;
import io.github.mucsi96.cooking.model.RecipeListItemResponse;
import io.github.mucsi96.cooking.model.RecipeResponse;
import io.github.mucsi96.cooking.model.SelectImageRequest;
import io.github.mucsi96.cooking.service.RecipeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class RecipeController {

  private final RecipeService recipeService;

  @GetMapping("/recipes")
  @PreAuthorize("hasAuthority('APPROLE_RecipeReader') and hasAuthority('SCOPE_readRecipes')")
  public List<RecipeListItemResponse> listRecipes() {
    return recipeService.listRecipes();
  }

  @GetMapping("/recipes/{id}")
  @PreAuthorize("hasAuthority('APPROLE_RecipeReader') and hasAuthority('SCOPE_readRecipes')")
  public RecipeResponse getRecipe(@PathVariable UUID id) {
    return recipeService.getRecipe(id);
  }

  @PostMapping("/recipes/import")
  @PreAuthorize("hasAuthority('APPROLE_RecipeCreator') and hasAuthority('SCOPE_createRecipe')")
  public RecipeResponse importRecipe(@Valid @RequestBody RecipeImportRequest request) {
    return recipeService.importRecipe(request.text());
  }

  @GetMapping("/recipes/{id}/images")
  @PreAuthorize("hasAuthority('APPROLE_RecipeReader') and hasAuthority('SCOPE_readRecipes')")
  public List<CandidateImageResponse> getCandidateImages(@PathVariable UUID id) {
    return recipeService.getCandidateImages(id);
  }

  @PostMapping("/recipes/{id}/images")
  @PreAuthorize("hasAuthority('APPROLE_RecipeCreator') and hasAuthority('SCOPE_createRecipe')")
  public List<CandidateImageResponse> generateCandidateImages(@PathVariable UUID id) {
    return recipeService.generateCandidateImages(id);
  }

  @PutMapping("/recipes/{id}/image")
  @PreAuthorize("hasAuthority('APPROLE_RecipeCreator') and hasAuthority('SCOPE_createRecipe')")
  public void selectImage(@PathVariable UUID id, @Valid @RequestBody SelectImageRequest request) {
    recipeService.selectImage(id, request.imageId());
  }
}
