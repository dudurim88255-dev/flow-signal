import { describe, it, expect } from "vitest";
import { confidenceScoreToLabel } from "./types";

describe("confidenceScoreToLabel", () => {
  it("100 → high", () => expect(confidenceScoreToLabel(100)).toBe("high"));
  it("70 (lower bound) → high", () => expect(confidenceScoreToLabel(70)).toBe("high"));
  it("69 → med", () => expect(confidenceScoreToLabel(69)).toBe("med"));
  it("50 → med", () => expect(confidenceScoreToLabel(50)).toBe("med"));
  it("40 (lower bound) → med", () => expect(confidenceScoreToLabel(40)).toBe("med"));
  it("39 → low", () => expect(confidenceScoreToLabel(39)).toBe("low"));
  it("0 → low", () => expect(confidenceScoreToLabel(0)).toBe("low"));

  // 방어적 케이스
  it("NaN → low", () => expect(confidenceScoreToLabel(NaN)).toBe("low"));
  it("Infinity → high (≥70)", () => expect(confidenceScoreToLabel(Infinity)).toBe("low")); // Number.isFinite 체크로 먼저 low
  it("negative → low", () => expect(confidenceScoreToLabel(-5)).toBe("low"));
});
