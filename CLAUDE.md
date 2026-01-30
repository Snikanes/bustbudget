# YNAB Clone - Project Context for Claude

## Project Overview

This is a budget management application inspired by YNAB (You Need A Budget), built as a full-stack TypeScript application. The app helps users manage their finances by tracking accounts, transactions, and budgets with a zero-based budgeting approach.

**Key Philosophy:** Every dollar is assigned a job. Money flows from accounts → Ready to Assign → Category assignments → Spending.

## Tech Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Routing:** React Router v6
- **State Management:** Zustand (UI state)
- **Data Fetching:** TanStack Query (React Query) with optimistic updates
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Build Tool:** Vite

### Backend
- **Runtime:** Node.js with Express
- **Language:** TypeScript
- **Database:** SQLite
- **ORM:** None (raw SQL queries)
- **Database Driver:** better-sqlite3

### Development
- **Package Manager:** npm workspaces (monorepo structure)
- **TypeScript:** Strict mode enabled
- **Dev Server:** Vite (frontend) + tsx watch (backend)

## Project Structure

```
ynab-clone/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── api/           # API client utilities
│   │   ├── components/    # React components
│   │   │   ├── accounts/  # Account-related components
│   │   │   ├── budget/    # Budget view and category components
│   │   │   └── layout/    # Layout components (sidebars, etc)
│   │   ├── hooks/
│   │   │   └── queries/   # React Query hooks
│   │   ├── stores/        # Zustand stores
│   │   └── types/         # TypeScript type definitions
│   └── package.json
│
├── server/                # Backend Express application
│   ├── data/             # SQLite database file
│   ├── src/
│   │   ├── db/           # Database initialization and schema
│   │   ├── middleware/   # Express middleware (error handling)
│   │   ├── models/       # TypeScript type definitions
│   │   ├── routes/       # API route handlers
│   │   └── services/     # Business logic layer
│   └── package.json
│
├── TODO.md               # Planned improvements and features
└── package.json          # Root workspace configuration
```

## Database Schema

### Core Tables

**account** - Bank/credit card accounts
- Tracks account name and closed status
- Balance calculated from transactions

**category_group** - Groups of categories (e.g., "Fixed Expenses")
- Has sort_order for custom ordering
- Can contain multiple categories

**category** - Budget categories (e.g., "Rent", "Groceries")
- Can belong to a group (or be ungrouped)
- Has sort_order within group

**transaction** - Financial transactions
- Links to account and optionally category
- Supports transfers between accounts
- Has cleared/uncleared status
- Starting balance transactions for initial account setup

**transfer** - Links two transactions as a transfer
- Ensures transfers stay in sync

**monthly_budget** - Budget assignments per category per month
- Stores how much was assigned to each category in each month
- Format: YYYY-MM (e.g., "2026-01")

**category_target** - Savings goals for categories
- Three types: monthly, yearly, by_date
- Stores target amount and date
- by_date targets calculate monthly amounts based on remaining time

**payee** - Payee names with last used category
- Auto-fill feature for transactions

### Important Constraints

- Amounts stored as **INTEGER (cents)** to avoid floating-point errors
- Negative amounts = outflows, Positive = inflows
- Transactions cannot have both category_id and transfer_id
- Starting balance transactions cannot have category_id
- One target per category (UNIQUE constraint)
- CASCADE delete on category targets when category deleted

## Key Concepts

### Budget Calculation

**Available to Assign** = Total Inflows - Total Assigned
- Inflows: Positive transactions without category + starting balances
- Only UNCATEGORIZED inflows count (categorized inflows go to category activity)

**Category Available** = Cumulative Assigned + Cumulative Activity
- Cumulative = all time through current month
- Activity = transactions in category (negative for spending)

**Overspending** reduces Available to Assign in subsequent months

### Target Types

1. **Monthly Target**
   - Recurring goal (e.g., assign 5000 kr every month)
   - Quick assign button assigns full target amount

2. **Yearly Target**
   - Annual goal by December 31
   - Quick assign button assigns full target amount

3. **By Date Target**
   - Specific date goal (e.g., 10,000 kr by June 2026)
   - Smart calculation: (Target - Available) ÷ Months Remaining
   - Accounts for existing progress
   - Quick assign button assigns calculated monthly amount

### Transfer Handling

Transfers create TWO transactions:
- Outflow from source account (negative amount)
- Inflow to destination account (positive amount)
- Linked via transfer table
- Both transactions excluded from category activity

## API Structure

### REST Conventions

- **GET** `/api/resource` - List all
- **GET** `/api/resource/:id` - Get one
- **POST** `/api/resource` - Create
- **PUT** `/api/resource/:id` - Update
- **DELETE** `/api/resource/:id` - Delete

### Response Formats

- Database rows use **snake_case** (stored format)
- API responses use **camelCase** (transformed in services)
- Amounts always in cents (integer)
- Dates in ISO string format (YYYY-MM-DD)

### Error Handling

Custom error classes:
- `NotFoundError` - 404
- `ValidationError` - 400
- Global error handler middleware

## Frontend Patterns

### React Query Keys

```typescript
// Organized by resource
budgetKeys.all = ['budget']
budgetKeys.month(month) = ['budget', month]

targetKeys.all = ['targets']
targetKeys.byCategory(id) = ['targets', id]
```

### Optimistic Updates

Budget assignments use optimistic updates:
1. Cancel outgoing queries
2. Snapshot current data
3. Update cache optimistically
4. On error, rollback to snapshot
5. On settle, refetch for consistency

### UI State (Zustand)

```typescript
useUIStore:
- selectedMonth: string (current budget month)
- selectedCategory: Category | null (for inspector)
- setSelectedMonth, setSelectedCategory
```

### Component Structure

- **Layout components** handle sidebars and page structure
- **View components** represent pages (BudgetView, AccountView)
- **Feature components** handle specific functionality (CategoryTarget)
- **Shared components** for reusable UI elements

## Development Workflow

### Running the App

```bash
npm run dev  # Starts both frontend and backend
```

- Frontend: http://localhost:5174
- Backend: http://localhost:3001
- Database: `server/data/budget.db`

### Making Changes

1. **Database changes:**
   - Update `server/src/db/schema.sql`
   - Delete database file to recreate: `rm server/data/budget.db`
   - Or write migration script

2. **New API endpoint:**
   - Add route in `server/src/routes/`
   - Add service in `server/src/services/`
   - Register route in `server/src/index.ts`
   - Add types in `server/src/models/types.ts`

3. **New frontend feature:**
   - Add component in `client/src/components/`
   - Add React Query hooks in `client/src/hooks/queries/`
   - Add types in `client/src/types/index.ts`

### Commit Guidelines

- Use imperative mood ("Add feature" not "Added feature")
- Include detailed description in commit body
- Group related changes in single commit
- End commits with: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`

## Recent Major Features

### Category Targets (Completed)
- Three target types: monthly, yearly, by_date
- Smart calculation for by_date targets
- Quick assign button with type-specific logic
- Visual feedback and validation
- localStorage persistence

### Resizable Sidebars (Completed)
- Left sidebar resizable (200-500px)
- Drag handle with visual feedback
- Width persisted in localStorage
- Smooth real-time resizing

## Important Files

### Configuration
- `client/src/api/client.ts` - API wrapper with error handling
- `server/src/db/index.ts` - Database initialization
- `server/src/middleware/errorHandler.ts` - Error handling middleware

### Key Components
- `client/src/components/budget/BudgetView.tsx` - Main budget screen
- `client/src/components/budget/CategoryInspector.tsx` - Right sidebar
- `client/src/components/budget/CategoryTarget.tsx` - Target UI
- `client/src/components/layout/LeftSidebar.tsx` - Resizable navigation

### Key Services
- `server/src/services/budgetService.ts` - Budget calculations
- `server/src/services/categoryTargetService.ts` - Target CRUD
- `server/src/services/transactionService.ts` - Transaction handling

## Known Patterns & Conventions

### Currency Formatting

```typescript
// Always store as INTEGER cents
const amount = 100000; // = 1000.00 kr

// Format for display (Norwegian)
new Intl.NumberFormat('nb-NO', {
  style: 'currency',
  currency: 'NOK',
  minimumFractionDigits: 2,
}).format(amount / 100);
```

### Date Handling

- Dates stored as strings: `YYYY-MM-DD`
- Month format: `YYYY-MM`
- Always use ISO format for consistency
- Convert to Date objects only when needed for calculations

### Database Queries

- Use prepared statements for all queries
- Always validate IDs and inputs
- Use transactions for multi-step operations
- Return transformed types (camelCase) from services

## Common Tasks

### Add a new field to category
1. Update `server/src/db/schema.sql`
2. Update `CategoryRow` in `server/src/models/types.ts`
3. Update `Category` interface (camelCase version)
4. Update transformation in service layer
5. Update `client/src/types/index.ts`
6. Recreate database or add migration

### Add a new API endpoint
1. Create route handler in appropriate routes file
2. Add service function in services layer
3. Add types for request/response
4. Register route in `server/src/index.ts`
5. Create React Query hook in client
6. Use hook in component

### Add localStorage persistence
1. Define storage key constant
2. Read on component mount (useState initializer)
3. Write on change (useEffect)
4. Handle missing/invalid values

## Testing Strategy

- Manual testing in browser during development
- Test all CRUD operations via UI
- Verify database state with SQLite queries
- Test error cases (validation, not found, etc)
- Check localStorage persistence across refreshes

## Next Steps (See TODO.md)

Priority improvements tracked in TODO.md:
1. Resizable right sidebar
2. Target progress indicators
3. Enhanced target display
4. Keyboard shortcuts
5. Export/import functionality

## Tips for Working on This Project

- **Always read before editing** - Use Read tool to understand current implementation
- **Maintain consistency** - Follow existing patterns for similar features
- **Test incrementally** - Verify each change works before moving on
- **Preserve data** - Be careful with database schema changes
- **Use optimistic updates** - Better UX for user actions
- **Store cents not dollars** - Avoid floating-point issues
- **Validate on both sides** - Frontend for UX, backend for security
- **Keep queries efficient** - SQLite is fast but still needs good indexing

## Helpful Commands

```bash
# View database schema
sqlite3 server/data/budget.db ".schema"

# Query data
sqlite3 server/data/budget.db "SELECT * FROM category_target;"

# Reset database (WARNING: deletes all data)
rm server/data/budget.db && npm run dev

# Check running processes
lsof -i :3001  # Backend
lsof -i :5174  # Frontend
```

## Architecture Decisions

### Why SQLite?
- Simple, file-based, no separate server needed
- Perfect for single-user desktop/local application
- ACID compliant, reliable
- Easy to backup (single file)

### Why React Query?
- Automatic caching and background refetching
- Optimistic updates for better UX
- Loading/error states handled automatically
- Reduces boilerplate code

### Why Zustand for UI State?
- Lightweight, simple API
- No provider boilerplate
- Only for transient UI state (selected month, category)
- Server state handled by React Query

### Why Monorepo?
- Shared TypeScript types (could be extracted)
- Single command to start both servers
- Easier to keep frontend/backend in sync
- Simpler deployment (everything in one repo)

---

**Last Updated:** January 30, 2026
**Current Version:** Active development, feature-complete for basic budgeting
