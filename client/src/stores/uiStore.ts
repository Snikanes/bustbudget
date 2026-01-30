import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EditingCell {
  type: 'budget' | 'transaction';
  id: string;
  field: string;
}

interface ModalState {
  type: 'transaction' | 'transfer' | 'category' | 'categoryGroup' | 'account';
  data?: Record<string, unknown>;
}

interface UIState {
  // Month selection
  selectedMonth: string; // YYYY-MM format
  setSelectedMonth: (month: string) => void;

  // Category group expansion
  expandedGroups: Set<string>;
  toggleGroupExpanded: (groupId: string) => void;
  expandAllGroups: (groupIds: string[]) => void;
  collapseAllGroups: () => void;

  // Inline editing
  editingCell: EditingCell | null;
  setEditingCell: (cell: EditingCell | null) => void;

  // Modals
  activeModal: ModalState | null;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Month selection
      selectedMonth: getCurrentMonth(),
      setSelectedMonth: (month) => set({ selectedMonth: month }),

      // Category group expansion
      expandedGroups: new Set<string>(),
      toggleGroupExpanded: (groupId) =>
        set((state) => {
          const newExpanded = new Set(state.expandedGroups);
          if (newExpanded.has(groupId)) {
            newExpanded.delete(groupId);
          } else {
            newExpanded.add(groupId);
          }
          return { expandedGroups: newExpanded };
        }),
      expandAllGroups: (groupIds) =>
        set({ expandedGroups: new Set(groupIds) }),
      collapseAllGroups: () => set({ expandedGroups: new Set() }),

      // Inline editing
      editingCell: null,
      setEditingCell: (cell) => set({ editingCell: cell }),

      // Modals
      activeModal: null,
      openModal: (modal) => set({ activeModal: modal }),
      closeModal: () => set({ activeModal: null }),
    }),
    {
      name: 'budget-ui-storage',
      partialize: (state) => ({
        selectedMonth: state.selectedMonth,
        expandedGroups: Array.from(state.expandedGroups),
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<UIState>),
        expandedGroups: new Set((persisted as { expandedGroups?: string[] })?.expandedGroups || []),
      }),
    }
  )
);
