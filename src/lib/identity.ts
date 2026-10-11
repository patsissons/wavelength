export interface Identity {
  playerId: string;
  token: string;
  name: string;
}

const PREFIX = "wavelength:identity:";
const LAST_NAME = "wavelength:lastName";

/**
 * A player's seat in a game, kept in localStorage so a reload or an iOS tab
 * discard reattaches to the same seat instead of creating a new player.
 */
export function loadIdentity(code: string): Identity | null {
  try {
    const raw = localStorage.getItem(PREFIX + code);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Identity).playerId === "string" &&
      typeof (parsed as Identity).token === "string"
    ) {
      return parsed as Identity;
    }
  } catch {
    /* storage unavailable or corrupt */
  }
  return null;
}

export function saveIdentity(code: string, identity: Identity): void {
  try {
    localStorage.setItem(PREFIX + code, JSON.stringify(identity));
    localStorage.setItem(LAST_NAME, identity.name);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearIdentity(code: string): void {
  try {
    localStorage.removeItem(PREFIX + code);
  } catch {
    /* ignore */
  }
}

export function lastName(): string {
  try {
    return localStorage.getItem(LAST_NAME) ?? "";
  } catch {
    return "";
  }
}

const AVATAR = "wavelength:avatar";

/** The avatar last chosen on this device, applied to every new seat. */
export function lastAvatar(): string | null {
  try {
    return localStorage.getItem(AVATAR) || null;
  } catch {
    return null;
  }
}

export function saveAvatar(avatar: string | null): void {
  try {
    if (avatar) localStorage.setItem(AVATAR, avatar);
    else localStorage.removeItem(AVATAR);
  } catch {
    /* ignore */
  }
}
