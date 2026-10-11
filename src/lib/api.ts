export interface CreatedGame {
  code: string;
  playerId: string;
  token: string;
}

export interface JoinedGame extends CreatedGame {
  phase: string;
}

export interface RoomStatus {
  code: string;
  exists: boolean;
  phase: string | null;
  playerCount: number;
  mode: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? "request_failed");
  return body as T;
}

export const api = {
  createGame: (name: string, avatar: string | null = null) =>
    request<CreatedGame>("/api/games", {
      method: "POST",
      body: JSON.stringify({ name, avatar }),
    }),
  joinGame: (code: string, name: string, avatar: string | null = null) =>
    request<JoinedGame>(`/api/games/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ name, avatar }),
    }),
  status: (code: string) => request<RoomStatus>(`/api/games/${code}`),
};
