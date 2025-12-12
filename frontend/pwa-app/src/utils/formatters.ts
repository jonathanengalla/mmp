export function formatCurrency(cents: number): string {
  const pesos = cents / 100;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(pesos);
}

