package recipe

import (
	"context"
	"net/netip"
	"strings"
	"testing"
)

func TestPageImport(t *testing.T) {
	text := "Gulyásleves\n500 g marhahús"
	actual, err := ResolvePage(context.Background(), text)
	if err != nil || actual != text {
		t.Fatalf("text changed: %q %v", actual, err)
	}
	for _, url := range []string{"http://127.0.0.1/recipe", "http://[::1]/recipe", "http://169.254.169.254/metadata", "http://user:pass@example.com/", "https://example.com:8443/"} {
		t.Run(url, func(t *testing.T) {
			if _, err := ResolvePage(context.Background(), url); err == nil {
				t.Fatal("accepted non-public URL")
			}
		})
	}
}

func TestPublicAddresses(t *testing.T) {
	for _, address := range []string{"0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.1.1", "172.16.0.1", "192.168.1.1", "224.0.0.1", "240.1.1.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "64:ff9b::7f00:1"} {
		if publicAddress(netip.MustParseAddr(address)) {
			t.Errorf("accepted %s", address)
		}
	}
	if !publicAddress(netip.MustParseAddr("93.184.216.34")) {
		t.Fatal("rejected public address")
	}
}

func TestPageContentPreservesRecipeMetadata(t *testing.T) {
	text, err := pageContent(`<html><head><title>Leves</title><script type="application/ld+json">{"recipeIngredient":["500 g hús"]}</script></head><body><nav>Ignore me</nav><p>Első lépés</p><p>Második lépés</p><script>bad()</script></body></html>`)
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{"Leves", "500 g hús", "Első lépés\n\nMásodik lépés"} {
		if !strings.Contains(text, expected) {
			t.Errorf("missing %q in %q", expected, text)
		}
	}
	if strings.Contains(text, "Ignore me") || strings.Contains(text, "bad()") {
		t.Fatal("included page scripts/navigation")
	}
	if _, err := pageContent("<body>" + strings.Repeat("x", MaxSourceCharacters+1) + "</body>"); err == nil {
		t.Fatal("accepted oversized source")
	}
}
