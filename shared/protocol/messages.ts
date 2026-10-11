import { z } from "zod";
import { AVATAR_MAX, isValidAvatar } from "../avatars/catalog";
import type { GameState } from "../game/types";
import { LIMITS } from "../game/types";
import type { GameEvent } from "./events";

/** The heartbeat frame is the bare string "ping"; the server answers "pong". */
export const PING = "ping";
export const PONG = "pong";

const CmdId = z.string().min(10).max(40);
const Position = z.number().min(0).max(1);
const PlayerId = z.string().min(1).max(40);
const DialId = z.string().min(1).max(40);
export const SideSchema = z.enum(["left", "right"]);
export const TeamIdSchema = z.enum(["left", "right"]);
export const NameSchema = z.string().trim().min(1).max(LIMITS.nameMax);
export const AvatarSchema = z
  .string()
  .min(1)
  .max(AVATAR_MAX)
  .refine(isValidAvatar, "not an avatar")
  .nullable();

export const SpectrumSchema = z.object({
  left: z.string().trim().min(1).max(LIMITS.labelMax),
  right: z.string().trim().min(1).max(LIMITS.labelMax),
});

export const SettingsPatchSchema = z
  .object({
    mode: z.enum(["teams", "coop", "ffa"]),
    targetScore: z
      .number()
      .int()
      .min(LIMITS.minTargetScore)
      .max(LIMITS.maxTargetScore),
    rounds: z.number().int().min(LIMITS.minRounds).max(LIMITS.maxRounds),
    psychicScoring: z.enum(["none", "average"]),
    catchUp: z.boolean(),
    firstTeam: z.enum(["left", "right", "random"]),
    firstPsychic: z.enum(["random", "order"]),
    maxSpins: z.number().int().min(0).max(LIMITS.maxSpins),
    customSpectra: z.array(SpectrumSchema).max(LIMITS.customSpectraMax),
    useBuiltInDeck: z.boolean(),
    effects: z.boolean(),
  })
  .partial();

const withCmd = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ cmdId: CmdId, ...shape });

/** Commands change state (carry a cmdId); ephemerals are relayed only. */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("resync") }),
  // ephemeral
  z.object({
    type: z.literal("dial.move"),
    dialId: DialId,
    position: Position,
  }),
  // lobby
  withCmd({ type: z.literal("settings.update"), patch: SettingsPatchSchema }),
  withCmd({ type: z.literal("team.join"), team: TeamIdSchema }),
  withCmd({ type: z.literal("player.rename"), name: NameSchema }),
  withCmd({ type: z.literal("player.setAvatar"), avatar: AvatarSchema }),
  withCmd({ type: z.literal("game.start") }),
  // psychic
  withCmd({ type: z.literal("card.draw") }),
  withCmd({
    type: z.literal("card.pickSide"),
    side: z.union([z.literal(0), z.literal(1)]),
  }),
  withCmd({
    type: z.literal("spin.flick"),
    velocity: z.number().min(-60).max(60),
  }),
  withCmd({ type: z.literal("shroud.toggle"), open: z.boolean() }),
  withCmd({
    type: z.literal("clue.submit"),
    clue: z.string().trim().min(1).max(LIMITS.clueMax),
  }),
  // guessers
  withCmd({ type: z.literal("dial.set"), dialId: DialId, position: Position }),
  withCmd({ type: z.literal("dial.accept"), dialId: DialId }),
  withCmd({ type: z.literal("dial.unaccept"), dialId: DialId }),
  withCmd({ type: z.literal("vote.cast"), side: SideSchema }),
  // flow / host
  withCmd({ type: z.literal("round.next") }),
  withCmd({ type: z.literal("host.forceLock") }),
  withCmd({ type: z.literal("host.skipRound") }),
  withCmd({ type: z.literal("host.kick"), playerId: PlayerId }),
  withCmd({ type: z.literal("host.transfer"), playerId: PlayerId }),
  withCmd({ type: z.literal("host.endGame") }),
  withCmd({ type: z.literal("game.playAgain") }),
  // effects
  withCmd({
    type: z.literal("effect.send"),
    effectId: z.string().min(1).max(40),
  }),
  withCmd({ type: z.literal("poke.send"), playerId: PlayerId }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ClientMessageType = ClientMessage["type"];

/** Messages that carry a cmdId and go through the command handler. */
export type Command = Extract<ClientMessage, { cmdId: string }>;
export type CommandType = Command["type"];

export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;

export type ErrorCode =
  | "bad_message"
  | "unauthorized"
  | "not_allowed"
  | "wrong_phase"
  | "invalid"
  | "rate_limited"
  | "room_full"
  | "no_game";

export type Ephemeral =
  | { kind: "dial.live"; dialId: string; position: number; by: string }
  | { kind: "effect"; effectId: string; from: string; nonce: string }
  | { kind: "poke"; from: string; to: string; nonce: string };

export type ServerMessage =
  | {
      type: "snapshot";
      state: GameState;
      you: { playerId: string; target: number | null };
    }
  | { type: "event"; version: number; event: GameEvent }
  | { type: "ephemeral"; payload: Ephemeral }
  | { type: "private"; target: number }
  | { type: "ack"; cmdId: string; version: number }
  | { type: "error"; cmdId?: string; code: ErrorCode; message: string };

export function parseClientMessage(
  raw: string,
): { ok: true; message: ClientMessage } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid json" };
  }
  const result = ClientMessageSchema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "invalid" };
  }
  return { ok: true, message: result.data };
}

export function isCommand(message: ClientMessage): message is Command {
  return "cmdId" in message;
}
