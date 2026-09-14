package io.github.mucsi96.cooking.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.io.IOException;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class RecipePageServiceTest {

  private static final String URL = "https://93.184.216.34/recipe";
  private final RecipePageService service = new RecipePageService();

  @Test
  void preservesPastedTextIncludingEmbeddedLinks() {
    final String text = "Soup\n500 g beef\nSource: https://example.com/recipe";
    assertEquals(text, service.resolve(text));
  }

  @Test
  void extractsPageTextAndStructuredRecipeData() throws Exception {
    final var document = Jsoup.parse("""
        <html><head><title>Goulash soup</title>
        <script type="application/ld+json">{"@type":"Recipe","recipeYield":"4",
        "recipeIngredient":["500 g beef"],"recipeInstructions":"Simmer for one hour."}</script>
        <style>unrelated styling</style></head>
        <body><nav>Navigation links</nav><main><h1>Goulash soup</h1>
        <p>Fry the onions.</p><p>Add the beef.</p></main>
        <script>tracking()</script><footer>Unrelated footer</footer></body></html>
        """);
    final var response = mock(Connection.Response.class);
    when(response.statusCode()).thenReturn(200);
    when(response.bodyAsBytes()).thenReturn(new byte[100]);
    when(response.parse()).thenReturn(document);
    final var connection = mock(Connection.class, RETURNS_SELF);
    when(connection.execute()).thenReturn(response);

    try (final var jsoup = mockStatic(Jsoup.class)) {
      jsoup.when(() -> Jsoup.connect(URL)).thenReturn(connection);
      final String source = service.resolve("  " + URL + "\n");

      assertTrue(source.contains("Goulash soup"));
      assertTrue(source.contains("Fry the onions."));
      assertTrue(source.contains("Add the beef."));
      assertTrue(source.contains("500 g beef"));
      assertTrue(source.contains("Simmer for one hour."));
      assertFalse(source.contains("Navigation links"));
      assertFalse(source.contains("tracking()"));
      assertFalse(source.contains("unrelated styling"));
      assertFalse(source.contains("Unrelated footer"));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {
      "http://127.0.0.1/recipe", "http://10.0.0.1/recipe", "http://192.168.0.1/recipe",
      "http://169.254.169.254/metadata", "http://[::1]/recipe", "http://[fd00::1]/recipe",
      "http://100.64.0.1/recipe", "https://user:password@93.184.216.34/recipe",
      "http://93.184.216.34:8080/recipe", "https://"
  })
  void rejectsNonPublicOrInvalidUrls(String url) {
    // A bare scheme is also recognized as an attempted URL.
    final var exception = assertThrows(ResponseStatusException.class, () -> service.resolve(url));
    assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
  }

  @Test
  void rejectsRedirectsToPrivateAddresses() throws Exception {
    final var response = mock(Connection.Response.class);
    when(response.statusCode()).thenReturn(302);
    when(response.header("Location")).thenReturn("http://127.0.0.1/secrets");
    final var connection = mock(Connection.class, RETURNS_SELF);
    when(connection.execute()).thenReturn(response);
    try (final var jsoup = mockStatic(Jsoup.class)) {
      jsoup.when(() -> Jsoup.connect(URL)).thenReturn(connection);
      assertThrows(ResponseStatusException.class, () -> service.resolve(URL));
      jsoup.verify(() -> Jsoup.connect(URL));
      jsoup.verifyNoMoreInteractions();
    }
  }

  @Test
  void followsRelativeRedirects() throws Exception {
    final var redirect = mock(Connection.Response.class);
    when(redirect.statusCode()).thenReturn(301);
    when(redirect.header("Location")).thenReturn("/new-recipe");
    final var response = mock(Connection.Response.class);
    when(response.statusCode()).thenReturn(200);
    when(response.bodyAsBytes()).thenReturn(new byte[100]);
    when(response.parse()).thenReturn(Jsoup.parse("<p>500 g beef</p>"));
    final var connection = mock(Connection.class, RETURNS_SELF);
    when(connection.execute()).thenReturn(redirect, response);
    try (final var jsoup = mockStatic(Jsoup.class)) {
      jsoup.when(() -> Jsoup.connect(anyString())).thenReturn(connection);
      assertTrue(service.resolve(URL).contains("500 g beef"));
      jsoup.verify(() -> Jsoup.connect("https://93.184.216.34/new-recipe"));
    }
  }

  @Test
  void rejectsRedirectLoops() throws Exception {
    final var response = mock(Connection.Response.class);
    when(response.statusCode()).thenReturn(302);
    when(response.header("Location")).thenReturn(URL);
    final var connection = mock(Connection.class, RETURNS_SELF);
    when(connection.execute()).thenReturn(response);
    try (final var jsoup = mockStatic(Jsoup.class)) {
      jsoup.when(() -> Jsoup.connect(URL)).thenReturn(connection);
      assertThrows(ResponseStatusException.class, () -> service.resolve(URL));
    }
  }

  @Test
  void reportsUnreadablePagesAsImportErrors() throws Exception {
    final var connection = mock(Connection.class, RETURNS_SELF);
    when(connection.execute()).thenThrow(new IOException("Page unavailable"));
    try (final var jsoup = mockStatic(Jsoup.class)) {
      jsoup.when(() -> Jsoup.connect(URL)).thenReturn(connection);
      assertThrows(ResponseStatusException.class, () -> service.resolve(URL));
    }
  }

  @Test
  void rejectsOversizedPages() throws Exception {
    final var response = mock(Connection.Response.class);
    when(response.statusCode()).thenReturn(200);
    when(response.bodyAsBytes()).thenReturn(new byte[2 * 1024 * 1024 + 1]);
    final var connection = mock(Connection.class, RETURNS_SELF);
    when(connection.execute()).thenReturn(response);
    try (final var jsoup = mockStatic(Jsoup.class)) {
      jsoup.when(() -> Jsoup.connect(URL)).thenReturn(connection);
      assertThrows(ResponseStatusException.class, () -> service.resolve(URL));
    }
  }
}
