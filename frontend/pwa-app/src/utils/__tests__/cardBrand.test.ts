/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { getCardBrandLabel } from "../cardBrand";

describe("getCardBrandLabel", () => {
  it("maps Mastercard to MC", () => {
    expect(getCardBrandLabel("MasterCard")).toBe("MC");
    expect(getCardBrandLabel("mastercard")).toBe("MC");
    expect(getCardBrandLabel("MASTERCARD")).toBe("MC");
    expect(getCardBrandLabel("Master Card")).toBe("MC");
    expect(getCardBrandLabel("master")).toBe("MC");
  });

  it("maps Visa to VISA", () => {
    expect(getCardBrandLabel("Visa")).toBe("VISA");
    expect(getCardBrandLabel("visa")).toBe("VISA");
    expect(getCardBrandLabel("VISA")).toBe("VISA");
  });

  it("maps American Express to AMEX", () => {
    expect(getCardBrandLabel("American Express")).toBe("AMEX");
    expect(getCardBrandLabel("amex")).toBe("AMEX");
    expect(getCardBrandLabel("AMEX")).toBe("AMEX");
  });

  it("maps Discover to DISC", () => {
    expect(getCardBrandLabel("Discover")).toBe("DISC");
    expect(getCardBrandLabel("discover")).toBe("DISC");
  });

  it("maps JCB to JCB", () => {
    expect(getCardBrandLabel("JCB")).toBe("JCB");
    expect(getCardBrandLabel("jcb")).toBe("JCB");
  });

  it("maps Diners Club to DINERS", () => {
    expect(getCardBrandLabel("Diners Club")).toBe("DINERS");
    expect(getCardBrandLabel("diners")).toBe("DINERS");
  });

  it("maps UnionPay to UP", () => {
    expect(getCardBrandLabel("UnionPay")).toBe("UP");
    expect(getCardBrandLabel("union pay")).toBe("UP");
  });

  it("handles null/undefined gracefully", () => {
    expect(getCardBrandLabel(null)).toBe("CARD");
    expect(getCardBrandLabel(undefined)).toBe("CARD");
    expect(getCardBrandLabel("")).toBe("CARD");
  });

  it("falls back to first 4 chars for unknown brands", () => {
    expect(getCardBrandLabel("UnknownBrand")).toBe("UNKN");
    expect(getCardBrandLabel("Test")).toBe("TEST");
  });

  it("handles whitespace", () => {
    expect(getCardBrandLabel("  MasterCard  ")).toBe("MC");
    expect(getCardBrandLabel("  Visa  ")).toBe("VISA");
  });
});

