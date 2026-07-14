import { describe, it, expect } from "vitest";
import { resolveClasses } from "../src/classes/resolveClasses.js";

describe("resolveClasses", () => {
  it("resolves the documented example into tokens", () => {
    const { tokens, warnings } = resolveClasses(
      "grid-3x2 card-elevated icons-line gap-md density-medium accent-blue"
    );
    expect(tokens.layout).toEqual({ kind: "grid", cols: 3, rows: 2 });
    expect(tokens.card).toEqual({ variant: "elevated" });
    expect(tokens.icons).toEqual({ style: "line" });
    expect(tokens.gap).toBe("md");
    expect(tokens.density).toBe("medium");
    expect(tokens.accent).toBe("blue");
    expect(warnings.count).toBe(0);
  });

  it("resolves workflow + arrows + cards", () => {
    const { tokens } = resolveClasses("workflow-5 cards elevated arrows-soft accent-blue");
    expect(tokens.layout).toEqual({ kind: "workflow", steps: 5 });
    expect(tokens.useCards).toBe(true);
    expect(tokens.elevated).toBe(true);
    expect(tokens.arrows).toEqual({ style: "soft" });
  });

  it("resolves hero + gradient + title scale", () => {
    const { tokens } = resolveClasses("hero bg-gradient-soft title-xl");
    expect(tokens.hero).toBe(true);
    expect(tokens.layout).toEqual({ kind: "hero" });
    expect(tokens.background).toBe("gradient-soft");
    expect(tokens.titleScale).toBe("xl");
  });

  it("warns (but does not throw) on unknown classes", () => {
    const { tokens, warnings } = resolveClasses("grid-2x2 totally-made-up");
    expect(tokens.layout).toEqual({ kind: "grid", cols: 2, rows: 2 });
    expect(warnings.count).toBe(1);
    expect(warnings.all()[0].code).toBe("unknown-class");
    expect(tokens.applied).toContain("grid-2x2");
    expect(tokens.applied).not.toContain("totally-made-up");
  });

  it("later classes win on conflict", () => {
    const { tokens } = resolveClasses("gap-sm gap-lg");
    expect(tokens.gap).toBe("lg");
  });
});
