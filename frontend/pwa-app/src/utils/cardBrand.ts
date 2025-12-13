/**
 * Card brand display label mapping
 * Maps internal brand strings to standardized display abbreviations
 */

/**
 * Get the display label for a card brand
 * @param brand - The card brand string (case-insensitive)
 * @returns Standardized abbreviation for display
 */
export function getCardBrandLabel(brand: string | null | undefined): string {
  if (!brand) return "CARD";

  const normalized = brand.toLowerCase().trim();

  // Map common brand variations to display labels
  const brandMap: Record<string, string> = {
    // Mastercard variations
    mastercard: "MC",
    "master card": "MC",
    master: "MC",
    mast: "MC",
    
    // Visa
    visa: "VISA",
    
    // American Express
    "american express": "AMEX",
    amex: "AMEX",
    "amex express": "AMEX",
    
    // Discover
    discover: "DISC",
    
    // JCB
    jcb: "JCB",
    
    // Diners Club
    "diners club": "DINERS",
    diners: "DINERS",
    
    // UnionPay
    unionpay: "UP",
    "union pay": "UP",
  };

  // Check exact match first
  if (brandMap[normalized]) {
    return brandMap[normalized];
  }

  // Check if normalized starts with any known brand prefix
  for (const [key, label] of Object.entries(brandMap)) {
    if (normalized.startsWith(key) || key.startsWith(normalized)) {
      return label;
    }
  }

  // Fallback: return first 4 chars uppercased (original behavior for unknown brands)
  return brand.slice(0, 4).toUpperCase();
}

