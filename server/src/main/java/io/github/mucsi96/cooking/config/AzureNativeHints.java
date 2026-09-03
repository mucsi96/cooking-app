package io.github.mucsi96.cooking.config;

import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.core.type.filter.AssignableTypeFilter;

import com.azure.core.exception.HttpResponseException;
import com.azure.core.util.ExpandableStringEnum;
import com.azure.json.JsonSerializable;
import com.azure.xml.XmlSerializable;

/**
 * Reachability metadata for the parts of the Azure SDK that its own metadata
 * misses.
 *
 * {@code ExpandableStringEnum} constants are created by
 * {@code ExpandableStringEnum.fromString}, which instantiates the subclass
 * reflectively and returns {@code null} when it cannot. In a native image
 * without a hint that turns every constant of the class into {@code null}, and
 * the first use fails with a {@link NullPointerException} far from the cause.
 * Two of azure-identity's subclasses ship no metadata, and without them
 * building any Azure client fails at startup - but naming those two would
 * leave the next one to be rediscovered the same painful way, so they are
 * scanned for like everything else here.
 *
 * The scan covers a second, quieter gap. azure-core picks how to read a
 * response body by asking the model class whether it declares the
 * {@code fromXml} / {@code fromJson} pair that azure-xml and azure-json
 * generate, and it asks with {@code Class.getDeclaredMethods()}. In a native
 * image that returns nothing for a class with no reachability metadata, so the
 * answer is silently "no" and azure-core falls back to Jackson - which for XML
 * means an {@code XmlMapper}, and jackson-dataformat-xml is not on the
 * classpath, so the call dies with a {@code NoClassDefFoundError} far from the
 * model that caused it. The SDK ships metadata for most of its models but not
 * all of them, and the error models carried by exceptions are among the ones it
 * misses. Registering every model rather than the handful missing today keeps
 * this from having to be rediscovered on the next SDK upgrade.
 *
 * None of this can be reproduced by the AOT-on-JVM run described in AGENTS.md -
 * reflection always works there. It only shows up in the native image.
 */
@Configuration(proxyBeanMethods = false)
@ImportRuntimeHints(AzureNativeHints.Registrar.class)
public class AzureNativeHints {

  static class Registrar implements RuntimeHintsRegistrar {

    private static final String AZURE_PACKAGE = "com.azure";

    private static final Class<?>[] REFLECTED_TYPES = {
        ExpandableStringEnum.class,
        XmlSerializable.class,
        JsonSerializable.class,
        HttpResponseException.class
    };

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
      final ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(
          false);

      for (Class<?> type : REFLECTED_TYPES) {
        scanner.addIncludeFilter(new AssignableTypeFilter(type));
      }

      for (BeanDefinition definition : scanner.findCandidateComponents(AZURE_PACKAGE)) {
        hints.reflection().registerTypeIfPresent(classLoader, definition.getBeanClassName(),
            MemberCategory.INVOKE_DECLARED_CONSTRUCTORS, MemberCategory.INVOKE_DECLARED_METHODS);
      }
    }
  }
}
