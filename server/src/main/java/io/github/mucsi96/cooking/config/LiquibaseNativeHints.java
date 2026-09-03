package io.github.mucsi96.cooking.config;

import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;

/**
 * Reachability metadata for the Liquibase change types the changelog uses.
 *
 * Liquibase validates a changelog by re-computing every change set's checksum,
 * and the checksum is a serialization of the change object: the
 * {@code StringChangeLogSerializer} walks each change's serializable fields
 * through {@code ChangeParameterMetaData}, which invokes the getters
 * reflectively - all of them, including the ones the changelog leaves unset
 * such as {@code catalogName}. The reachability metadata the GraalVM
 * repository ships for liquibase-core was recorded from runs that did not walk
 * that path for every change type: it lists {@code AddPrimaryKeyChange}'s
 * getters only behind conditions that are not reached here, so the first
 * changelog with an {@code addPrimaryKey} change dies at startup with
 * {@code MissingReflectionRegistrationError: Cannot reflectively invoke method
 * AddPrimaryKeyChange.getCatalogName()} - inside the Liquibase bean, before
 * anything is served, and only in the native image.
 *
 * Every class under {@code liquibase.change} is registered rather than the
 * change types the changelog uses today, so a new change type in a future
 * changelog cannot bring this back: the package holds the change
 * implementations, the {@code ColumnConfig} / {@code ConstraintsConfig} value
 * objects they serialize, and nothing else of size.
 *
 * The AOT-on-JVM run described in AGENTS.md cannot show the failure -
 * reflection always works there.
 */
@Configuration(proxyBeanMethods = false)
@ImportRuntimeHints(LiquibaseNativeHints.Registrar.class)
public class LiquibaseNativeHints {

  static class Registrar implements RuntimeHintsRegistrar {

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
      PackageReflectionHints.register(hints, classLoader, "liquibase.change");
    }
  }
}
