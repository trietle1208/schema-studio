import { create } from 'zustand';
import type { ToastProps } from '../components/Toast';
import { clampZoom } from '../core/layout';

/** The dialog open over the workspace. */
export type Dialog = { kind: 'delete-table'; table: string };

export type ToastContent = Omit<ToastProps, 'onClose'>;

export interface ToastMessage extends ToastContent {
  /** Tells one toast from the next, so a timer or action only ever dismisses its own. */
  id: number;
}

export interface UiState {
  zoom: number;
  /** The toolbar search text; it filters the tables shown on the canvas. */
  search: string;
  /** Bumped each time the selected table should enter rename mode (F2, context menu). */
  renameSignal: number;
  /** While a dialog is open it owns the keyboard: the workspace shortcuts are off. */
  dialog: Dialog | null;
  /** The workspace shows one toast at a time; a new one replaces it. */
  toast: ToastMessage | null;
  setZoom: (zoom: number) => void;
  setSearch: (search: string) => void;
  requestRename: () => void;
  openDialog: (dialog: Dialog) => void;
  closeDialog: () => void;
  /** Returns the id to pass to `dismissToast`. */
  showToast: (toast: ToastContent) => number;
  /** Does nothing when another toast has replaced the one called `id`. */
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  zoom: 1,
  search: '',
  renameSignal: 0,
  dialog: null,
  toast: null,
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  setSearch: (search) => set({ search }),
  requestRename: () => set((s) => ({ renameSignal: s.renameSignal + 1 })),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  showToast: (toast) => {
    const id = ++toastId;
    set({ toast: { ...toast, id } });
    return id;
  },
  dismissToast: (id) => {
    if (get().toast?.id === id) set({ toast: null });
  },
}));
