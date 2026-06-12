import { describe, it, expect } from "vitest";
import en from "../../../messages/en.json";
import uk from "../../../messages/uk.json";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const p = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v)
      ? keys(v as Record<string, unknown>, p)
      : [p];
  });
}

describe("i18n message parity", () => {
  it("EN and UK have identical key sets", () => {
    const a = keys(en).sort();
    const b = keys(uk).sort();
    expect({
      onlyInEn: a.filter((k) => !b.includes(k)),
      onlyInUk: b.filter((k) => !a.includes(k)),
    }).toEqual({ onlyInEn: [], onlyInUk: [] });
  });
});
