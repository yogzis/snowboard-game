import { describe, it, expect } from "vitest";
import { hexToCss, hexToRgb, getConfigValue } from "./config.js";

describe("hexToCss", () => {
  it("converts hex to CSS string", () => {
    expect(hexToCss(0x20b2aa)).toBe("#20b2aa");
  });

  it("pads short hex values", () => {
    expect(hexToCss(0xffffff)).toBe("#ffffff");
    expect(hexToCss(0x0)).toBe("#000000");
  });
});

describe("hexToRgb", () => {
  it("converts white to 0-1 RGB", () => {
    expect(hexToRgb(0xffffff)).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("converts black to 0-1 RGB", () => {
    expect(hexToRgb(0x000000)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("converts arbitrary hex to correct components", () => {
    expect(hexToRgb(0xff0000)).toEqual({ r: 1, g: 0, b: 0 });
    expect(hexToRgb(0x00ff00)).toEqual({ r: 0, g: 1, b: 0 });
    expect(hexToRgb(0x0000ff)).toEqual({ r: 0, g: 0, b: 1 });
  });
});

describe("getConfigValue", () => {
  it("returns defined value when key exists", () => {
    const obj = { foo: 42 };
    expect(getConfigValue(obj, "foo", 0)).toBe(42);
  });

  it("returns fallback when key is undefined", () => {
    const obj = {};
    expect(getConfigValue(obj, "missing", "default")).toBe("default");
  });

  it("returns fallback when value is null", () => {
    const obj = { key: null };
    expect(getConfigValue(obj, "key", "fallback")).toBe("fallback");
  });

  it("returns 0 when defined (falsy but valid)", () => {
    const obj = { count: 0 };
    expect(getConfigValue(obj, "count", 10)).toBe(0);
  });

  it("returns fallback when obj is null or undefined", () => {
    expect(getConfigValue(null, "key", "fallback")).toBe("fallback");
    expect(getConfigValue(undefined, "key", "fallback")).toBe("fallback");
  });
});
