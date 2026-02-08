import { Request } from 'express';

// Database row types (as stored in SQLite)

// User and auth types
export interface UserRow {
  id: string;
  google_id: string | null;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: string;
  updated_at: string;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  is_closed: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryGroupRow {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  user_id: string;
  group_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  transfer_id: string | null;
  date: string;
  amount: number;
  payee: string | null;
  memo: string | null;
  is_cleared: number;
  is_starting_balance: number;
  created_at: string;
  updated_at: string;
}

export interface TransferRow {
  id: string;
  from_txn_id: string;
  to_txn_id: string;
  created_at: string;
}

export interface MonthlyBudgetRow {
  id: string;
  user_id: string;
  category_id: string;
  year_month: string;
  assigned_amount: number;
  created_at: string;
  updated_at: string;
}

export interface PayeeRow {
  id: string;
  user_id: string;
  name: string;
  last_category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryTargetRow {
  id: string;
  user_id: string;
  category_id: string;
  target_type: 'monthly' | 'yearly' | 'by_date';
  target_amount: number;
  target_date: string;
  recurrence_day: number | null;
  created_at: string;
  updated_at: string;
}

export interface ImportPayeeMappingRow {
  id: string;
  user_id: string;
  original_payee: string;
  payee_id: string;
  created_at: string;
  updated_at: string;
}

// Extended row type with joined payee data
export interface ImportPayeeMappingWithPayeeRow extends ImportPayeeMappingRow {
  payee_name: string;
  last_category_id: string | null;
}

export interface ImportProfileRow {
  id: string;
  user_id: string;
  name: string;
  file_type: string;
  config: string;
  created_at: string;
  updated_at: string;
}

// API response types (camelCase, with computed fields)

// User types
export interface User {
  id: string;
  googleId: string | null;
  email: string;
  name: string | null;
  picture: string | null;
  createdAt: string;
  updatedAt: string;
}

// Authenticated request type for Express middleware
export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

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
  isReconciled: boolean;
  isStartingBalance: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface MonthlyBudget {
  id: string;
  categoryId: string;
  yearMonth: string;
  assignedAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payee {
  id: string;
  name: string;
  lastCategoryId: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface ImportPayeeMapping {
  id: string;
  originalPayee: string;
  payeeId: string;
  payeeName: string;
  lastCategoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportProfile {
  id: string;
  name: string;
  fileType: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Budget calculation types
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
    sortOrder: number;
    categories: BudgetEntry[];
  }[];
  ungroupedCategories: BudgetEntry[];
}

// Request body types
export interface CreateAccountRequest {
  name: string;
  initialBalance?: number;
  initialBalanceDate?: string;
}

export interface UpdateAccountRequest {
  name?: string;
}

export interface CreateCategoryGroupRequest {
  name: string;
  sortOrder?: number;
}

export interface UpdateCategoryGroupRequest {
  name?: string;
  sortOrder?: number;
}

export interface CreateCategoryRequest {
  name: string;
  groupId?: string;
  sortOrder?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  groupId?: string | null;
  sortOrder?: number;
}

export interface CreateTransactionRequest {
  date: string;
  amount: number;
  payee?: string;
  categoryId?: string;
  memo?: string;
  isCleared?: boolean;
}

export interface UpdateTransactionRequest {
  date?: string;
  amount?: number;
  payee?: string;
  categoryId?: string | null;
  memo?: string;
  isCleared?: boolean;
}

export interface CreateTransferRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  memo?: string;
  isCleared?: boolean;
}

export interface UpdateBudgetRequest {
  assigned: number;
}

export interface ImportTransactionItem {
  date: string;
  amount: number;
  payee?: string;
  memo?: string;
  categoryId?: string;
}

export interface ImportTransactionsRequest {
  transactions: ImportTransactionItem[];
}

export interface ImportTransactionsResponse {
  imported: number;
  skipped: number;
  transactions: Transaction[];
}

export interface CreateCategoryTargetRequest {
  targetType: 'monthly' | 'yearly' | 'by_date';
  targetAmount: number;
  targetDate: string;
  recurrenceDay?: number;
}

export interface UpdateCategoryTargetRequest {
  targetType?: 'monthly' | 'yearly' | 'by_date';
  targetAmount?: number;
  targetDate?: string;
  recurrenceDay?: number | null;
}

export interface RenamingRule {
  id: string;
  originalPayee: string;
}

export interface PayeeWithDetails {
  id: string;
  name: string;
  lastCategoryId: string | null;
  transactionCount: number;
  renamingRules: RenamingRule[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePayeeRequest {
  name: string;
}

export interface CreateImportProfileRequest {
  name: string;
  fileType: string;
  config: Record<string, unknown>;
}

export interface UpdateImportProfileRequest {
  name?: string;
  config?: Record<string, unknown>;
}
