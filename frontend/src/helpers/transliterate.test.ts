import { describe, it, expect } from "vitest";
import { transliterate } from "./transliterate";

describe("transliterate", () => {
  it("maps Ukrainian letters with position-independent casing", () => {
    expect(transliterate("Олена")).toBe("Olena");
    expect(transliterate("Сергій")).toBe("Serhiy");
    expect(transliterate("Київ")).toBe("Kyiv");
  });

  it("uses distinct upper/lowercase mappings (Є→Ye, є→ie)", () => {
    expect(transliterate("Євген")).toBe("Yevhen");
    expect(transliterate("своє")).toBe("svoie");
  });

  it("maps multi-letter sounds", () => {
    expect(transliterate("Щука")).toBe("Shchuka");
    expect(transliterate("Жанна")).toBe("Zhanna");
    expect(transliterate("Христина")).toBe("Khrystyna");
  });

  it("strips soft signs and apostrophes", () => {
    expect(transliterate("компʼютер")).toBe("kompyuter");
    expect(transliterate("сіль")).toBe("sil");
    expect(transliterate("м'ята")).toBe("myata");
  });

  it("passes through latin, digits and punctuation", () => {
    expect(transliterate("Olena 2024, Milano!")).toBe("Olena 2024, Milano!");
    expect(transliterate("")).toBe("");
  });
});
