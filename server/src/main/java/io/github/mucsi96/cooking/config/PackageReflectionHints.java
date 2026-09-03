package io.github.mucsi96.cooking.config;

import java.util.regex.Pattern;

import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.beans.factory.annotation.AnnotatedBeanDefinition;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;

/**
 * Registers every class of the given packages for reflective construction,
 * method invocation and field access - the metadata {@code jackson-module-kotlin}
 * needs for the Kotlin SDKs (see {@link AnthropicNativeHints} and
 * {@link OpenAINativeHints}).
 *
 * The scan reads bytecode rather than loading classes, and skips anonymous and
 * lambda classes. Both matter: Spring AI's own
 * {@code AiRuntimeHints.findJsonAnnotatedClassesInPackage} helper loads every
 * candidate, and loading one of those synthetic classes here
 * ({@code SseHandler$mapJson$1$handle$1}) throws
 * "This function has a reified type parameter and thus can only be inlined at
 * compilation time", which fails the build outright.
 */
final class PackageReflectionHints {

  /** Anonymous and lambda classes: a {@code $} followed by a digit. */
  private static final Pattern SYNTHETIC = Pattern.compile("\\$\\d");

  private PackageReflectionHints() {
  }

  static void register(RuntimeHints hints, ClassLoader classLoader, String... packages) {
    final ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(
        false) {
      @Override
      protected boolean isCandidateComponent(AnnotatedBeanDefinition beanDefinition) {
        // The default rejects abstract types, which is where the SDKs put their
        // unions - ContentBlock and friends are needed just as much.
        return true;
      }
    };
    scanner.addIncludeFilter((metadataReader, metadataReaderFactory) -> true);

    for (String pkg : packages) {
      for (BeanDefinition definition : scanner.findCandidateComponents(pkg)) {
        final String name = definition.getBeanClassName();
        if (name == null || SYNTHETIC.matcher(name).find()) {
          continue;
        }
        hints.reflection().registerTypeIfPresent(classLoader, name,
            MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
            MemberCategory.INVOKE_DECLARED_METHODS,
            MemberCategory.ACCESS_DECLARED_FIELDS);
      }
    }
  }
}
