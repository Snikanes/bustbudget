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
  transferId: string | null;
  transferAccountId: string | null;
  transferAccountName: string | null;
  date: string;
  amount: number;
  payee: string | null;
  memo: string | null;
  isCleared: boolean;
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
  assigned: number;
  activity: number;
  available: number;
}

export interface BudgetMonth {
  month: string;
  availableToAssign: number;
  totalInflows: number;
  totalAssigned: number;
  groups: {
    id: string;
    name: string;
    categories: BudgetEntry[];
  }[];
  ungroupedCategories: BudgetEntry[];
}

export interface Transfer {
  id: string;
  fromTransactionId: string;
  toTransactionId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  memo: string | null;
  createdAt: string;
}
