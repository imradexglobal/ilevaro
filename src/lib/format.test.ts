import { describe, it, expect } from "vitest";
import { formatCurrency, generateReference } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats zero naira", () => {
    expect(formatCurrency(0)).toContain("0");
  });

  it("formats positive amounts with comma separators", () => {
    const result = formatCurrency(1250000);
    expect(result).toContain("1,250,000");
  });

  it("formats negative amounts", () => {
    const result = formatCurrency(-5000);
    expect(result).toContain("5,000");
  });

  it("does not use floating-point artifacts", () => {
    const result = formatCurrency(0.1 + 0.2);
    expect(result).not.toContain("0.30000000000000004");
  });
});

describe("generateReference", () => {
  it("produces a reference with the given prefix", () => {
    const ref = generateReference("PROP");
    expect(ref.startsWith("PROP-")).toBe(true);
  });

  it("produces unique references", () => {
    const refs = new Set(Array.from({ length: 1000 }, () => generateReference("PAY")));
    expect(refs.size).toBe(1000);
  });

  it("produces references with expected segment count", () => {
    const ref = generateReference("TEN");
    const parts = ref.split("-");
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe("TEN");
  });
});
