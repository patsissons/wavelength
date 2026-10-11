import { describe, expect, it } from "vitest";
import { LIMITS } from "../game/types";
import { mulberry32 } from "../util/random";
import { CARDS } from "./cards";
import { formatCustomSpectra, parseCustomSpectra } from "./custom";
import { buildDeck, customCards, deckRemaining, drawCard } from "./deck";

describe("built-in cards", () => {
  it("has at least 150 cards with unique ids", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });

  it("has non-empty, short, unique spectra", () => {
    const seen = new Set<string>();
    for (const card of CARDS) {
      for (const side of card.sides) {
        expect(side.left.trim().length).toBeGreaterThan(0);
        expect(side.right.trim().length).toBeGreaterThan(0);
        expect(side.left.length, side.left).toBeLessThanOrEqual(
          LIMITS.labelMax,
        );
        expect(side.right.length, side.right).toBeLessThanOrEqual(
          LIMITS.labelMax,
        );
        const key = `${side.left}|${side.right}`.toLowerCase();
        expect(seen.has(key), key).toBe(false);
        seen.add(key);
      }
    }
  });

  const spectra = CARDS.flatMap((c) => c.sides);
  const labels = spectra.flatMap((s) => [s.left, s.right]);
  const words = (label: string) => label.toLowerCase().split(/\s+/);
  const isTemplate = (s: { left: string }) => /^(bad|worst) /i.test(s.left);

  it("caps the Bad X | Great X template and never doubles it on a card", () => {
    const templated = spectra.filter(isTemplate).length;
    expect(templated / spectra.length).toBeLessThanOrEqual(0.15);
    for (const card of CARDS) {
      expect(card.sides.every(isTemplate), card.id).toBe(false);
    }
  });

  it("keeps labels short: mostly one or two words, never more than four", () => {
    const twoOrFewer = labels.filter((l) => words(l).length <= 2).length;
    expect(twoOrFewer / labels.length).toBeGreaterThanOrEqual(0.75);
    for (const label of labels) {
      expect(words(label).length, label).toBeLessThanOrEqual(4);
    }
  });

  it("never pairs a label with itself", () => {
    for (const side of spectra) {
      expect(side.left.toLowerCase()).not.toBe(side.right.toLowerCase());
    }
  });

  it("puts unrelated spectra on the two sides of a card", () => {
    const stopwords = new Set(
      "a an the to of for in on at and or with from it bad good great fine worst best".split(
        " ",
      ),
    );
    const meaningful = (side: { left: string; right: string }) =>
      new Set(
        [...words(side.left), ...words(side.right)].filter(
          (w) => !stopwords.has(w),
        ),
      );
    for (const card of CARDS) {
      const [a, b] = card.sides;
      const shared = [...meaningful(a)].filter((w) => meaningful(b).has(w));
      expect(shared, card.id).toEqual([]);
    }
  });

  it("uses Canadian spelling", () => {
    const denied = [
      /\bcolor/,
      /\bfavorite/,
      /\bflavor/,
      /\bsavory/,
      /\bneighbor/,
      /\bhonor/,
      /\bhumor/,
      /\bcenter/,
      /\bcosy/,
      /(organ|real|energ|recogn)is(e|ing|ed)\b/,
    ];
    for (const label of labels) {
      for (const pattern of denied) {
        expect(pattern.test(label.toLowerCase()), label).toBe(false);
      }
    }
  });
});

describe("custom spectra", () => {
  it("parses common separators and drops bad lines", () => {
    const parsed = parseCustomSpectra(
      [
        "Cold | Hot",
        "Soft - Hard",
        "Old <-> New",
        "Cheap vs Expensive",
        "   ",
        "no separator here",
        "cold | hot",
        "x | " + "y".repeat(LIMITS.labelMax + 1),
      ].join("\n"),
    );
    expect(parsed).toEqual([
      { left: "Cold", right: "Hot" },
      { left: "Soft", right: "Hard" },
      { left: "Old", right: "New" },
      { left: "Cheap", right: "Expensive" },
    ]);
    expect(formatCustomSpectra(parsed).split("\n")).toHaveLength(4);
  });

  it("pairs spectra two per card and borrows a side for a leftover", () => {
    const cards = customCards(
      [
        { left: "a", right: "b" },
        { left: "c", right: "d" },
        { left: "e", right: "f" },
      ],
      mulberry32(1),
    );
    expect(cards).toHaveLength(2);
    expect(cards[0]!.sides).toEqual([
      { left: "a", right: "b" },
      { left: "c", right: "d" },
    ]);
    expect(cards[1]!.sides[0]).toEqual({ left: "e", right: "f" });
    expect(cards[1]!.sides[1].left.length).toBeGreaterThan(0);
  });
});

describe("deck", () => {
  it("shuffles deterministically for a seed", () => {
    const a = buildDeck(
      { customSpectra: [], useBuiltInDeck: true },
      mulberry32(3),
    );
    const b = buildDeck(
      { customSpectra: [], useBuiltInDeck: true },
      mulberry32(3),
    );
    expect(a.order).toEqual(b.order);
    expect(deckRemaining(a)).toBe(CARDS.length);
  });

  it("uses only custom cards when the built-in deck is off", () => {
    const deck = buildDeck(
      {
        customSpectra: [
          { left: "a", right: "b" },
          { left: "c", right: "d" },
        ],
        useBuiltInDeck: false,
      },
      mulberry32(3),
    );
    expect(deck.cards).toHaveLength(1);
  });

  it("falls back to the built-in deck when there are no custom cards", () => {
    const deck = buildDeck(
      { customSpectra: [], useBuiltInDeck: false },
      mulberry32(3),
    );
    expect(deck.cards.length).toBe(CARDS.length);
  });

  it("never repeats a card until the deck is exhausted", () => {
    const random = mulberry32(9);
    let deck = buildDeck({ customSpectra: [], useBuiltInDeck: true }, random);
    const seen = new Set<string>();
    for (let i = 0; i < CARDS.length; i++) {
      const drawn = drawCard(deck, random);
      deck = drawn.deck;
      expect(seen.has(drawn.card.id)).toBe(false);
      seen.add(drawn.card.id);
    }
    expect(deckRemaining(deck)).toBe(0);
    const recent = [...deck.recent];
    const reshuffled = drawCard(deck, random);
    expect(recent).not.toContain(reshuffled.card.id);
    expect(deckRemaining(reshuffled.deck)).toBe(
      CARDS.length - recent.length - 1,
    );
  });
});
