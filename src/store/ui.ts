import { create } from 'zustand';
import { clampZoom } from '../core/layout';

export interface UiState {
  zoom: number;
  setZoom: (zoom: number) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  zoom: 1,
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
}));
