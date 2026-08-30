package io.github.mucsi96.cooking.entity;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Embeddable
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Ingredient {

  @Column(nullable = false)
  private String name;

  @Column(precision = 10, scale = 2)
  private BigDecimal amount;

  @Column
  private String unit;
}
