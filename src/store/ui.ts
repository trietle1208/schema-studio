import { create } from 'zustand';
import { clampZoom } from '../core/layout';

export interface UiState {
  zoom: number;
  /** The toolbar search text; it filters the tables shown on the canvas. */
  search: string;
  /** Bumped each time the selected table should enter rename mode (F2, context menu). */
  renameSignal: number;
  setZoom: (zoom: number) => void;
  setSearch: (search: string) => void;
  requestRename: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  zoom: 1,
  search: '',
  renameSignal: 0,
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  setSearch: (search) => set({ search }),
  requestRename: () => set((s) => ({ renameSignal: s.renameSignal + 1 })),
}));
