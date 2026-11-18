package ai

// Both providers require additionalProperties=false and required fields.
// Use their shared schema subset; numeric and collection bounds are validated
// by the domain model because Anthropic does not support these constraints.
const recipeSchema = `{
  "type": "object",
  "additionalProperties": false,
  "required": ["title", "description", "category", "servings", "ingredients", "steps"],
  "properties": {
    "title": {"type": "string", "description": "Recipe title in Hungarian."},
    "description": {"type": "string", "description": "Short appetizing description in Hungarian."},
    "category": {"type": "string", "description": "Best matching Hungarian recipe category.", "enum": ["Reggeli", "Leves", "Főétel", "Köret", "Saláta", "Desszert", "Sütemény", "Ital", "Egyéb"]},
    "servings": {"type": "integer", "description": "Stated serving count, or 4 when unspecified."},
    "ingredients": {
      "type": "array", "description": "Ingredients in recipe order, with metric quantities where practical.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "amount", "unit"],
        "properties": {
          "name": {"type": "string", "description": "Ingredient name in Hungarian."},
          "amount": {"type": ["number", "null"], "description": "Decimal quantity, or null when unspecified."},
          "unit": {"type": ["string", "null"], "description": "Hungarian measurement unit, or null when unspecified."}
        }
      }
    },
    "steps": {"type": "array", "description": "Ordered preparation steps.", "items": {"type": "string", "description": "Self-contained imperative instruction in Hungarian."}}
  }
}`

const sceneSchema = `{
  "type": "object",
  "additionalProperties": false,
  "required": ["description"],
  "properties": {"description": {"type": "string", "description": "Detailed simple English food photograph description or source-photo editing instruction, with no text in the image."}}
}`
