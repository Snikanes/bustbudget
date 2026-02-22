export interface Account {
  id: string;
  name: string;
  isClosed: boolean;
  balance: number;
  clearedBalance: number;
  unclearedBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  sortOrder: number;
  categories: Category[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  groupId: string | null;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  categoryName: string | null;
  linkedTransactionId: string | null;
  transferAccountId: string | null;
  transferAccountName: string | null;
  date: string;
  amount: number;
  payee: string | null;
  memo: string | null;
  isCleared: boolean;
  isReconciled: boolean;
  isStartingBalance: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyBudget {
  id: string;
  categoryId: string;
  yearMonth: string;
  assignedAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetEntry {
  categoryId: string;
  categoryName: string;
  groupId: string | null;
  groupName: string | null;
  sortOrder: number;
  assigned: number;
  activity: number;
  available: number;
  target: CategoryTarget | null;
}

export interface BudgetMonth {
  month: string;
  availableToAssign: number;
  totalInflows: number;
  totalAssigned: number;
  overspending: number;
  groups: {
    id: string;
    name: string;
    categories: BudgetEntry[];
  }[];
  ungroupedCategories: BudgetEntry[];
}


export interface Payee {
  id: string;
  name: string;
  lastCategoryId: string | null;
}

export interface CategoryTarget {
  id: string;
  categoryId: string;
  targetType: 'monthly' | 'yearly' | 'by_date';
  targetAmount: number;
  targetDate: string;
  recurrenceDay: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportTransactionItem {
  date: string;
  amount: number;
  payee?: string;
  memo?: string;
  categoryId?: string;
}

export interface ImportTransactionsResponse {
  imported: number;
  skipped: number;
  transactions: Transaction[];
}

export interface ImportPayeeMapping {
  id: string;
  originalPayee: string;
  payeeId: string;
  payeeName: string;
  lastCategoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RenamingRule {
  id: string;
  originalPayee: string;
}

export type { ImportProfile } from './importMapping';

export interface PayeeWithDetails {
  id: string;
  name: string;
  lastCategoryId: string | null;
  transactionCount: number;
  renamingRules: RenamingRule[];
  createdAt: string;
  updatedAt: string;
}
