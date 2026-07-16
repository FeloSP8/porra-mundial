import { describe, it, expect } from "vitest";
import { playerSlug } from "./standings";

describe("playerSlug", () => {
  it("pasa a minúsculas y quita acentos", () => {
    expect(playerSlug("Julio")).toBe("julio");
    expect(playerSlug("José María")).toBe("jose-maria");
    expect(playerSlug("Ana Belén")).toBe("ana-belen");
  });

  it("colapsa símbolos y espacios a un solo guion, sin guiones en los bordes", () => {
    expect(playerSlug("  Juan   Pérez  ")).toBe("juan-perez");
    expect(playerSlug("Nº1 (crack)")).toBe("n-1-crack");
  });
});
