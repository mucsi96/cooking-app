package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mucsi96/cooking-app/server/internal/config"
)

func TestExtractionRejectsInvalidAIOutput(t *testing.T) {
	for _, tc := range []struct{ name, output, reason string }{
		{"invalid JSON", "not json", "end_turn"},
		{"missing ingredients", `{"title":"Leves","description":"Finom","category":"Leves","servings":4,"steps":["Főzd meg"]}`, "end_turn"},
		{"truncated", `{}`, "max_tokens"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/v1/messages" || r.Header.Get("x-api-key") != "test" {
					t.Errorf("unexpected AI request: %s", r.URL)
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]any{"id": "msg_test", "type": "message", "role": "assistant", "content": []map[string]string{{"type": "text", "text": tc.output}}, "stop_reason": tc.reason, "usage": map[string]int{"input_tokens": 1, "output_tokens": 1}})
			}))
			defer server.Close()
			client := New(config.Config{AnthropicURL: server.URL, AnthropicKey: "test", AnthropicModel: "test"})
			if _, err := client.Extract(context.Background(), "recept", nil); err == nil {
				t.Fatal("accepted invalid extraction")
			}
		})
	}
}
