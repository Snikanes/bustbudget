# YNAB Clone - TODO List

## High Priority Improvements

### 1. Make Right Sidebar Resizable
- [ ] Add resize functionality to CategoryInspector sidebar
- [ ] Match left sidebar behavior (drag, persist width, visual feedback)
- [ ] Set appropriate min/max width constraints (e.g., 300-600px)
- [ ] Store width in localStorage separately from left sidebar

### 2. Show Target Progress in Budget View
- [ ] Add visual progress indicators to budget table rows
- [ ] Show progress bar or percentage for categories with targets
- [ ] Display "X months remaining" for by_date targets
- [ ] Color-code based on progress (e.g., green if on track, red if behind)
- [ ] Show monthly amount needed for by_date targets in tooltip/indicator

### 3. Target Date Validation for by_date Targets
- [ ] Prevent selecting dates in the past when creating/editing targets
- [ ] Show warning message if target date has already passed
- [ ] Add option to mark past targets as completed or extend them
- [ ] Consider auto-archiving completed targets

### 4. Enhanced Target Display in CategoryInspector
- [ ] For by_date targets, show: "kr X remaining / Y months left"
- [ ] Display calculated monthly amount needed in display mode
- [ ] Add progress percentage indicator
- [ ] Show visual progress bar in inspector
- [ ] Add "days until target date" for near-term goals

## Medium Priority Improvements

### 5. Double-click to Reset Sidebar Widths
- [ ] Add double-click handler to left sidebar resize handle
- [ ] Add double-click handler to right sidebar resize handle (when implemented)
- [ ] Reset to default width on double-click
- [ ] Add subtle animation for the reset

### 6. Keyboard Shortcuts
- [ ] Tab to move between categories in budget view
- [ ] Enter to edit assigned amount
- [ ] Escape to close right sidebar
- [ ] Arrow keys for navigation
- [ ] Ctrl/Cmd + S to save (if in edit mode)
- [ ] Add keyboard shortcuts help modal (? key)

### 7. Bulk Target Operations
- [ ] Select multiple categories for bulk operations
- [ ] Set same target for multiple categories at once
- [ ] Copy target from one category to another
- [ ] Create target templates for common expenses
- [ ] Apply target template to category or group

### 8. Target Achievement Notifications
- [ ] Visual indicator when target is reached (100% funded)
- [ ] Celebration animation or color change
- [ ] Option to auto-create next period's target
- [ ] Show achievement history/stats
- [ ] Notification banner for completed targets

## Lower Priority Polish

### 9. Undo/Redo for Budget Assignments
- [ ] Implement undo/redo stack for budget changes
- [ ] Keyboard shortcuts (Ctrl/Cmd + Z for undo, Ctrl/Cmd + Shift + Z for redo)
- [ ] Show undo/redo buttons in UI
- [ ] Limit history to last 20 actions
- [ ] Visual feedback when undoing/redoing

### 10. Export/Import Functionality
- [ ] Export budget data to CSV
- [ ] Export transactions to CSV
- [ ] Import transactions from CSV (bank statements)
- [ ] Export full database backup
- [ ] Import from YNAB4 or nYNAB format
- [ ] Schedule automatic exports

## Completed Features

- [x] Category target/goals feature (monthly, yearly, by_date)
- [x] Quick assign button to apply target amount to budget
- [x] By_date target with smart monthly calculation
- [x] Calculation accounts for existing available amount
- [x] Resizable left sidebar with persistent width

---

## Notes

- Each item should be implemented in a separate commit
- Test thoroughly before committing
- Update this list as new ideas come up
- Mark items as complete with `[x]` when done
- Add sub-tasks as needed for complex features
