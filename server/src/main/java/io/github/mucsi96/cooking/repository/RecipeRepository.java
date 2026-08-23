package io.github.mucsi96.cooking.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import io.github.mucsi96.cooking.entity.Recipe;

public interface RecipeRepository extends JpaRepository<Recipe, UUID> {
}
