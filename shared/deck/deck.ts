import type { Card, Settings, Spectrum } from "../game/types";
import { shuffle } from "../util/random";
import { CARDS } from "./cards";

/** How many recently drawn cards stay out of a reshuffle. */
const RECENT = 10;

export interface DeckState {
  /** Every card available to this game (built-in and custom). */
  cards: Card[];
  /** Shuffled indexes into `cards`. */
  order: number[];
  cursor: number;
  /** Ids of the most recently drawn cards, newest last. */
  recent: string[];
}

/** Pair custom spectra two per card; an odd leftover borrows a built-in side. */
export function customCards(spectra: Spectrum[], random: () => number): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < spectra.length; i += 2) {
    const a = spectra[i]!;
    const b =
      spectra[i + 1] ??
      CARDS[Math.floor(random() * CARDS.length)]!.sides[random() < 0.5 ? 0 : 1];
    cards.push({ id: `c${String(i / 2 + 1).padStart(3, "0")}`, sides: [a, b] });
  }
  return cards;
}

export function buildDeck(
  settings: Pick<Settings, "customSpectra" | "useBuiltInDeck">,
  random: () => number,
): DeckState {
  const custom = customCards(settings.customSpectra, random);
  const cards =
    settings.useBuiltInDeck || custom.length === 0
      ? [...CARDS, ...custom]
      : custom;
  const order = shuffle(
    cards.map((_, i) => i),
    random,
  );
  return { cards, order, cursor: 0, recent: [] };
}

export function deckRemaining(deck: DeckState): number {
  return deck.order.length - deck.cursor;
}

/** Draw the next card, reshuffling (minus recent cards) when exhausted. */
export function drawCard(
  deck: DeckState,
  random: () => number,
): { card: Card; deck: DeckState } {
  let next = deck;
  if (next.cursor >= next.order.length) {
    const recent = new Set(next.recent);
    const fresh = next.cards
      .map((card, i) => ({ card, i }))
      .filter(({ card }) => !recent.has(card.id) || next.cards.length <= RECENT)
      .map(({ i }) => i);
    next = { ...next, order: shuffle(fresh, random), cursor: 0 };
  }
  const card = next.cards[next.order[next.cursor]!]!;
  const recent = [...next.recent, card.id].slice(-RECENT);
  return { card, deck: { ...next, cursor: next.cursor + 1, recent } };
}
