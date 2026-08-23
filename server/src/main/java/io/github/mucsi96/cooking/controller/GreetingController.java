package io.github.mucsi96.cooking.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import io.github.mucsi96.cooking.model.GreetingResponse;
import io.github.mucsi96.cooking.service.GreetingService;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class GreetingController {
  private final GreetingService greetingService;

  @GetMapping("/greeting")
  @PreAuthorize("hasAuthority('APPROLE_GreetingReader') and hasAuthority('SCOPE_readGreetings')")
  public GreetingResponse getGreeting() {
    return greetingService.getGreeting();
  }
}
