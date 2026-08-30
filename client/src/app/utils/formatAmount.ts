const FORMATTER = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 2 });

export function scaleAmount(
  amount: number,
  servings: number,
  baseServings: number
): number {
  return (amount * servings) / baseServings;
}

export function formatAmount(amount: number): string {
  return FORMATTER.format(amount);
}
