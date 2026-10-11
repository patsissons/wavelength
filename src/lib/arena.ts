import { create } from "zustand";

interface ArenaState {
  /** The post-round reactions arena is showing on this device. */
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** Client-only: whether this player is in the arena (it draws reactions itself). */
export const useArena = create<ArenaState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
