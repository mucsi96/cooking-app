# Cooking App - Development Guidelines

## General Code Style

- Avoid fallbacks, prefer failing fast
- Prefer functional programming patterns
- Prefer immutable data structures

## Java Style

- Use Lombok annotations (@Data, @Builder, @RequiredArgsConstructor)
- Constructor injection (via @RequiredArgsConstructor)
- Use Stream API for collections
- Use records for DTOs/responses

## TypeScript Style

- Use `const` by default
- Prefer spread operator for object/array operations
- Use functional array methods (map, filter, reduce)
- Use string literals over enums

## Testing Style

- Write tests from user perspective
- Use role-based selectors (getByRole)
- Use semantic selectors (getByText, getByLabel)
- E2E tests with Playwright

## Angular Style

- Use Angular Material components
- Use signals and resources (not rxjs where possible)
- Use string literals over enums
- Standalone components

## Design

- Material UI dark theme
- Skeleton loaders for loading states
- All user-facing text is Hungarian

## Project Overview

Recipe collection application based on the patterns of
[skeleton-app](https://github.com/mucsi96/skeleton-app):

- Recipes are grouped by Hungarian category with AI-generated thumbnails
- The recipe details page rescales ingredient amounts when the serving
  count is adjusted
- Recipes are imported by pasting free text in any language (English,
  German, ...); Anthropic Claude extracts a structured recipe and
  translates it to Hungarian
- The same import endpoint accepts plain text over the API, which drives
  the email-based import pipeline
- Thumbnails are generated asynchronously (several candidates per recipe,
  following the [learn-language](https://github.com/mucsi96/learn-language)
  approach); the user picks their favorite

## Architecture

- **client/** - Angular SPA with Material UI, MSAL authentication
- **server/** - Spring Boot REST API with PostgreSQL, Spring AI (Anthropic) and the OpenAI image API
- **mock_anthropic_server/** - Express mock for the Claude API (recipe extraction, image scene descriptions)
- **mock_openai_server/** - Express mock for the OpenAI image generation API
- **test/** - Playwright E2E tests
- **scripts/** - Build and deployment scripts
- **.github/workflows/** - CI/CD pipelines

## Key Technologies

- Spring Boot 4, Java 21 (built into a GraalVM native image)
- Angular 22
- PostgreSQL 17
- Spring AI (Anthropic) for structured recipe extraction
- openai-java for image generation, ffmpeg for webp thumbnails
- Azure AD (MSAL) authentication
- Azure Key Vault for secrets
- Traefik reverse proxy
- Docker multi-stage builds
- Playwright for E2E testing

## Development Commands

### Frontend
```bash
cd client && npm start        # Start dev server
cd client && npm run build    # Production build
```

### Backend
```bash
cd server && mvn spring-boot:run -Dspring-boot.run.profiles=local  # Start with local profile
```

Local development still runs on a plain JVM. The native image is built only by
the container build - see **Native image and the baked-in Spring profile**
below.

### Podman Development
```bash
scripts/pod_up.sh             # Build images and start test pod
scripts/pod_down.sh           # Stop and clean up test pod
scripts/dev_db_up.sh          # Start development PostgreSQL database
scripts/dev_db_down.sh        # Stop development database
```

### Testing
```bash
cd test && npm test           # Run E2E tests
cd test && npx playwright test --ui  # Interactive test runner
```

## API Routes

- `GET /api/environment` - Client configuration (public)
- `GET /api/recipes` - Recipe list for the category overview (RecipeReader)
- `GET /api/recipes/{id}` - Recipe details (RecipeReader)
- `POST /api/recipes/import` - Import a recipe from free text in any language; also used by the email pipeline (RecipeCreator)
- `GET /api/recipes/{id}/images` - Thumbnail candidate statuses (RecipeReader)
- `POST /api/recipes/{id}/images` - Generate a new batch of thumbnail candidates (RecipeCreator)
- `PUT /api/recipes/{id}/image` - Pick the favorite thumbnail (RecipeCreator)
- `GET /api/images/{id}` - Serve a generated webp image (RecipeReader)

## Data Model

- **recipes** - Title, description, category, servings, chosen image, all in Hungarian
- **recipe_ingredients** - Ordered ingredients with numeric amount and unit
- **recipe_steps** - Ordered preparation steps
- **image_generation_jobs** - Async thumbnail candidate jobs (PENDING/COMPLETED/FAILED) per recipe

## Configuration Patterns

### Spring Profiles
- **prod** - Production with Azure Key Vault and AAD
- **local** - Local development with Podman DB
- **test** - Testing with disabled auth and mock AI services

## Native image and the baked-in Spring profile

The server is compiled ahead of time into a GraalVM native executable linked
against musl, so there is no JRE in the runtime image and startup is in the tens
of milliseconds rather than seconds. The runtime image is Alpine with `ffmpeg`
installed for the webp thumbnails; the executable spawns it with a plain
`ProcessBuilder`, which needs nothing special in a native image.

Ahead-of-time processing resolves bean definitions at build time, which means
the active Spring profile is decided by the build, not by the environment:
Spring AOT emits an `EnvironmentPostProcessor` that activates the profile the
image was built with. `SPRING_PROFILES_ACTIVE` is no longer read at runtime, and
`test/test-pod.yaml` no longer sets it. Build one image per profile with the
`SPRING_PROFILE` build argument - `test` for the e2e pod, `prod` for the image
published to Docker Hub:

```bash
podman build --build-arg SPRING_PROFILE=test \
  -t localhost/cooking-app-server:test server
```

Build-time details that live in `server/pom.xml` and are easy to trip over:

- AOT processing refreshes the application context, so every placeholder an
  auto-configuration condition reads has to resolve during the build. The
  `process-aot` execution supplies build-time stand-ins for them and turns the
  Key Vault property source off, so the build never reaches out to Azure. The
  stand-ins are not baked into the image; they only have to make the same
  conditions match as the real values do at runtime. A new required environment
  placeholder read by a condition means adding it there too. Placeholders that
  are only read while creating beans (`${db-url}`, `${claude-api-key}`,
  `${openai-api-key}`, `${STORAGE_DIRECTORY}`) are resolved at runtime as
  before and need nothing.
- Spring AOT generates bean-definition classes into the packages of the
  configuration classes it processes, including the signed Spring Cloud Azure
  jars. Mixing generated (unsigned) and signed classes in one package makes the
  native-image builder throw `SecurityException: ... signer information does not
  match`, so the builder is pointed at `server/native-image.security`, which
  disables jar signature verification.
- Jars can ship a `META-INF/native-image/.../native-image.properties` that forces
  classes to build-time initialization. When such a class holds on to objects of
  types that are still initialized at run time, the builder fails with
  `UnsupportedFeatureException: An object of type ... was found in the image
  heap`. `--initialize-at-build-time` in the `native-maven-plugin` config covers
  the Jackson core classes `azure-core` leaves behind that way. Note that a build
  cannot undo such a directive: `exclude-config` does not apply to
  `native-image.properties`, and `initialize-at-run-time` for the same class is
  rejected outright. That is why `azure-core` is pinned ahead of the version the
  Azure BOM selects - the BOM's 1.58.0 forces SLF4J and logback to build-time
  initialization, which is irreconcilable with Spring Boot setting logging up at
  run time. Check this again when the Azure BOM moves.
- The Azure SDK's `ExpandableStringEnum` constants are built by instantiating the
  subclass reflectively, and `fromString` returns `null` rather than failing when
  it cannot. Missing reflection metadata therefore surfaces as every constant of
  a class being `null` and a `NullPointerException` far from the cause.
  `AzureNativeHints` registers the subclasses azure-identity does not ship
  metadata for.
- azure-core decides how to read a response body by asking the model class
  whether it declares the `fromXml` / `fromJson` pair azure-xml and azure-json
  generate, and it asks with `Class.getDeclaredMethods()`. In a native image that
  returns nothing for a class with no reachability metadata, so the answer is
  silently "no" and azure-core falls back to Jackson - for XML that means an
  `XmlMapper`, and jackson-dataformat-xml is not on the classpath, so the call
  dies with a `NoClassDefFoundError`. The SDK ships metadata for most of its
  models but not all. `AzureNativeHints` scans `com.azure` and registers every
  `XmlSerializable`, `JsonSerializable` and `HttpResponseException` instead of
  naming the ones missing today, so an SDK upgrade cannot reintroduce this.
- The Key Vault property source is configured by an `EnvironmentPostProcessor`
  that runs before there is an application context and reads its own settings
  with a plain `Binder` over `AzureKeyVaultSecretProperties`. Nothing in the
  framework infers that, and the auto-configuration that would otherwise
  contribute the binding metadata for that type never matches here - it is
  conditional on `spring.cloud.azure.keyvault[.secret].endpoint`, while this
  application configures the endpoint under `...secret.property-sources[0]`. With
  no members in the image the binder binds nothing, and an absent binding is
  indistinguishable from an empty configuration, so the post-processor quietly
  concludes there is no property source to add. Nothing fails at that point: the
  image starts and then dies much later on the first secret-backed placeholder.
  `KeyVaultPropertySourceNativeHints` supplies the metadata. Only the prod
  profile reads secrets from Key Vault, so no test covers this - after changing
  anything about the Key Vault configuration, check that the generated
  `target/spring-aot/main/resources/META-INF/native-image/**/reachability-metadata.json`
  still carries `AzureKeyVaultSecretProperties` and
  `AzureKeyVaultPropertySourceProperties` with their accessors.
- The Anthropic and OpenAI SDKs are Kotlin, and both serialize their models
  with `jackson-module-kotlin`, which maps Kotlin constructors back to
  `java.lang.reflect.Constructor` through Kotlin reflection. Without metadata
  that fails at request time as `KotlinReflectionInternalError: Could not
  compute caller for function`, naming Kotlin's reflection internals rather
  than the model that is missing. Neither SDK ships native-image metadata, so
  `AnthropicNativeHints` and `OpenAINativeHints` register the packages the
  application reaches (`com.anthropic.models.messages`, `com.openai.models.images`
  and both SDKs' `core` packages) through the shared `PackageReflectionHints`
  scanner. A call into a new SDK area (another OpenAI endpoint, the Anthropic
  beta API) means adding its package there.
- `RecipeImportService` reads the model's answer into `ExtractedRecipe` through
  Spring AI's `BeanOutputConverter`, which derives the JSON schema with the
  victools generator and binds the answer with a plain `ObjectMapper`. Neither
  is inferred by the framework's AOT processing, so the record carries a
  `@RegisterReflectionForBinding` hint. A new structured-output type needs the
  same.

Spring Cloud Azure needs one workaround in application code:
`AzureGlobalPropertiesConfiguration` re-declares the `AzureGlobalProperties`
bean. Spring Cloud Azure registers it from an `ImportBeanDefinitionRegistrar`
using a lambda instance supplier, which AOT cannot turn into generated code, so
it drops the bean and the image fails to start with "required a bean of type
AzureGlobalProperties that could not be found". See the class comment for why it
uses its own bean name. That workaround turns on Spring Cloud Azure's
registration order, which is not a public contract, so smoke-test the image
whenever `spring-cloud-azure-dependencies` moves - a change there could drop the
bean again with no compile-time signal.

The image is deliberately not built with `--static`. A fully static binary links
but then segfaults the moment it starts in the container - before GraalVM
installs its own segfault handler, so with no output whatsoever, which looks
exactly like a container that silently never starts.

### Reproducing AOT problems without a native build

Most AOT problems reproduce without waiting for a native compile (which takes
several minutes). Run the AOT-processed application on a normal JVM:

```bash
cd server
mvn -Pnative package -DskipTests -Dapp.profile=test
java -Dspring.aot.enabled=true -jar target/cooking-0.0.1-SNAPSHOT.jar
```

That exercises the generated context - missing bean definitions, profile and
condition mismatches - in seconds. Only class-initialization and reflection
problems need the real `mvn -Pnative native:compile`.

Types that are only ever bound reflectively need explicit hints. Controller
request/response types, JPA entities and Spring Data repositories are covered by
the framework's own AOT processing and need nothing. Types read with a plain
`ObjectMapper` want `@RegisterReflectionForBinding` (see `RecipeImportService`);
types bound by a `Binder` rather than Jackson want `BindableRuntimeHintsRegistrar`,
which registers exactly what `JavaBeanBinder` looks for over the whole class
hierarchy - see `KeyVaultPropertySourceNativeHints`.

### Release and image publishing

`publish-server` and `publish-client` each ask `mucsi96/get-next-version` for a
version. It answers from the newest `server-N` / `client-N` tag: no changes under
the component's directory since that tag means no version, and every publish step
is skipped. The release step must therefore tag the commit its image was built
from - `target_commitish: ${{ github.sha }}` - because the action otherwise tags
whatever the default branch points at when the release is created, and the
server's native build takes long enough that another push can land first. A tag
left on a commit that was never built makes the next run believe that commit is
already released, so nothing is published for it. That is silent: `deploy`
resolves the newest tag on Docker Hub by `last_updated` and succeeds, deploying
the previous commit's image, so a fix can look deployed while the running image
predates it. When a change does not reach production, check that a release tag
exists on the commit and that `publish-server` did not skip its build steps.

### Environment Config
- Server exposes `/api/environment` endpoint
- Client fetches config before bootstrap
- Conditionally enables MSAL based on `mockAuth` flag

### Secrets (Azure Key Vault)
- `claude-api-key` - Anthropic API key for recipe extraction and image descriptions
- `openai-api-key` - OpenAI API key for thumbnail generation
- `db-url`, `db-username`, `db-password` - PostgreSQL connection

### Storage
- Generated images are stored as webp files under `STORAGE_DIRECTORY`
  (mount a persistent volume in production)
