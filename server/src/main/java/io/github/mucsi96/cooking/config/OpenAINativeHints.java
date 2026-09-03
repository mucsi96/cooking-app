package io.github.mucsi96.cooking.config;

import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;

/**
 * Reachability metadata for the OpenAI SDK's request and response models.
 *
 * openai-java is built the same way as the Anthropic SDK: Kotlin classes
 * serialized by the SDK's own Jackson {@code ObjectMapper} with
 * {@code jackson-module-kotlin} registered, which maps Kotlin constructors
 * back to {@code java.lang.reflect.Constructor} through Kotlin reflection. In
 * a native image without metadata that fails with
 * {@code KotlinReflectionInternalError: Could not compute caller for function}
 * while serializing {@code ImageGenerateParams}, and the response side fails
 * the same way while reading {@code ImagesResponse} back - see
 * {@link AnthropicNativeHints} for the full account.
 *
 * openai-java ships no native-image metadata (4.43.0), so the packages the
 * image call touches are registered here: the images models, and the core
 * package that carries {@code JsonField}, {@code JsonValue} and the
 * serializers and deserializers every model is annotated with.
 * {@code com.openai.models} as a whole is left out deliberately - it is the
 * bulk of the SDK, and nothing here calls anything but the images API.
 *
 * Only the native image needs this. The AOT-on-JVM run described in AGENTS.md
 * cannot show the failure - reflection always works there.
 */
@Configuration(proxyBeanMethods = false)
@ImportRuntimeHints(OpenAINativeHints.Registrar.class)
public class OpenAINativeHints {

  static class Registrar implements RuntimeHintsRegistrar {

    private static final String[] PACKAGES = {
        "com.openai.models.images",
        "com.openai.core",
        "com.openai.errors"
    };

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
      PackageReflectionHints.register(hints, classLoader, PACKAGES);
    }
  }
}
