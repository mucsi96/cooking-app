package io.github.mucsi96.cooking.config;

import java.lang.reflect.Array;
import java.util.Arrays;
import java.util.Optional;
import java.util.stream.Stream;

import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.util.ClassUtils;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

/**
 * Reachability metadata for the identifier array types Hibernate allocates
 * reflectively.
 *
 * On PostgreSQL, Hibernate loads several entities by id with a single
 * array-parameter query, and {@code MultiIdEntityLoaderArrayParam} prepares
 * that at session-factory creation by allocating an empty array of the
 * identifier type through {@code Array.newInstance}. Spring's JPA hints cover
 * the entity classes themselves, but not the array of their id type, so an
 * entity keyed by {@code UUID} fails at startup, inside the
 * {@code entityManagerFactory} bean, with
 * {@code MissingReflectionRegistrationError: Cannot reflectively instantiate
 * the array class 'java.util.UUID[]'}.
 *
 * Every entity's {@code @Id} type is registered rather than {@code UUID[]}
 * alone, so an entity keyed differently later does not fail the same way. The
 * AOT-on-JVM run described in AGENTS.md cannot show this - reflection always
 * works there.
 */
@Configuration(proxyBeanMethods = false)
@ImportRuntimeHints(EntityIdArrayNativeHints.Registrar.class)
public class EntityIdArrayNativeHints {

  static class Registrar implements RuntimeHintsRegistrar {

    private static final String ENTITY_PACKAGE = "io.github.mucsi96.cooking.entity";

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
      final ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(
          false);
      scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));

      scanner.findCandidateComponents(ENTITY_PACKAGE).stream()
          .map(BeanDefinition::getBeanClassName)
          .map(name -> ClassUtils.resolveClassName(name, classLoader))
          .flatMap(entity -> idType(entity).stream())
          .map(idType -> Array.newInstance(idType, 0).getClass())
          .forEach(arrayType -> hints.reflection().registerType(arrayType));
    }

    private static Optional<Class<?>> idType(Class<?> entity) {
      return Stream.<Class<?>>iterate(entity, type -> type != null, Class::getSuperclass)
          .flatMap(type -> Arrays.stream(type.getDeclaredFields()))
          .filter(field -> field.isAnnotationPresent(Id.class))
          .<Class<?>>map(field -> field.getType())
          .findFirst();
    }
  }
}
