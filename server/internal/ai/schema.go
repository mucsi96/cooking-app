package ai

// OpenAI strict Structured Outputs requires all properties to be required and
// additionalProperties=false on every object. Unspecified quantities remain null.
const recipeSchema = `{
  "type": "object",
  "additionalProperties": false,
  "required": ["title", "description", "category", "servings", "ingredients", "steps"],
  "properties": {
    "title": {"type": "string"},
    "description": {"type": "string"},
    "category": {"type": "string", "enum": ["Reggeli", "Leves", "Főétel", "Köret", "Saláta", "Desszert", "Sütemény", "Ital", "Egyéb"]},
    "servings": {"type": "integer", "minimum": 1},
    "ingredients": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "amount", "unit"],
        "properties": {
          "name": {"type": "string"},
          "amount": {"type": ["number", "null"], "minimum": 0},
          "unit": {"type": ["string", "null"]}
        }
      }
    },
    "steps": {"type": "array", "minItems": 1, "items": {"type": "string"}}
  }
}`
