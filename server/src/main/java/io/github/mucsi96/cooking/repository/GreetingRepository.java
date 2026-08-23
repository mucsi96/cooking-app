package io.github.mucsi96.cooking.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import io.github.mucsi96.cooking.entity.Greeting;

public interface GreetingRepository extends JpaRepository<Greeting, Long> {
}
