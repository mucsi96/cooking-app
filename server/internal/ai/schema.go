package ai

// Both providers require additionalProperties=false and required fields.
// Use their shared schema subset; numeric and collection bounds are validated
// by the domain model because Anthropic does not support these constraints.
const recipeSchema = `{
  "type": "object",
  "additionalProperties": false,
  "required": ["title", "description", "category", "servings", "ingredients", "steps"],
  "properties": {
    "title": {"type": "string"},
    "description": {"type": "string"},
    "category": {"type": "string", "enum": ["Reggeli", "Leves", "Főétel", "Köret", "Saláta", "Desszert", "Sütemény", "Ital", "Egyéb"]},
    "servings": {"type": "integer"},
    "ingredients": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "amount", "unit"],
        "properties": {
          "name": {"type": "string"},
          "amount": {"type": ["number", "null"]},
          "unit": {"type": ["string", "null"]}
        }
      }
    },
    "steps": {"type": "array", "items": {"type": "string"}}
  }
}`

const sceneSchema = `{
  "type": "object",
  "additionalProperties": false,
  "required": ["description"],
  "properties": {"description": {"type": "string"}}
}`
