# Delete Pin Feature Implementation Tasks

## Task Overview
Implement a delete pin functionality that:
1. Shows a trashcan icon on the right side of each pin item
2. Removes the :pinned: tag from the org item when deleting
3. Performs an incremental search to update the list
4. Follows TDD approach with E2E tests

## Task List

### Phase 1: E2E Test Implementation (TDD)

- [ ] **Task 1.1: Update existing delete pin E2E test**
  - Update `tests/e2e/crud-operations.spec.ts` to have proper assertions
  - Test should verify trashcan icon appears on hover
  - Test should verify deletion removes pin from list
  - Test should verify org file is modified (pinned tag removed)
  - Test should verify incremental scan updates the UI

- [ ] **Task 1.2: Add comprehensive delete pin E2E scenarios**
  - Test deleting first pin in list
  - Test deleting middle pin in list
  - Test deleting last pin in list
  - Test deleting all pins shows empty state
  - Test delete button only appears on hover
  - Test delete operation updates org file content

### Phase 2: Backend Implementation

- [ ] **Task 2.1: Add remove pin IPC handlers**
  - Uncomment and implement `REMOVE_PIN` IPC channel in `src/shared/types.ts`
  - Add `removePin` method to `ElectronAPI` interface
  - Implement IPC handler in `src/main/index.ts`

- [ ] **Task 2.2: Implement org file modification service**
  - Add method to `src/main/services/orgService.ts` to remove pinned tags
  - Method should remove `:pinned:` or `:PINNED:` properties from org headlines
  - Method should remove `pinned` tags from headline tags array
  - Method should update the file on disk

- [ ] **Task 2.3: Add preload API exposure**
  - Uncomment `removePin` method in `src/preload/index.ts`
  - Ensure proper contextBridge exposure

### Phase 3: Frontend Implementation

- [ ] **Task 3.1: Add delete functionality to pin store**
  - Uncomment and implement `removePin` method in `src/renderer/stores/pinStore.ts`
  - Add optimistic UI updates
  - Add error handling with rollback

- [ ] **Task 3.2: Update TrayPopup component UI**
  - Add trashcan icon (Trash2) to pin items
  - Icon should only be visible on hover
  - Icon should be positioned on the right side
  - Add click handler for delete functionality
  - Add confirmation dialog or immediate deletion

- [ ] **Task 3.3: Update shared types**
  - Uncomment `onRemovePin` callback in `TrayPopupProps`
  - Ensure proper TypeScript typing throughout

### Phase 4: Integration & Polish

- [ ] **Task 4.1: Wire up delete functionality**
  - Connect TrayPopup delete handler to pin store
  - Ensure proper error handling and user feedback
  - Add loading states during deletion

- [ ] **Task 4.2: Test incremental scanning after deletion**
  - Verify that after deleting a pin, incremental scan works correctly
  - Ensure the deleted pin doesn't reappear after scan
  - Verify file modifications are properly cached

- [ ] **Task 4.3: Add visual feedback**
  - Add confirmation dialog (optional)
  - Add loading spinner during deletion
  - Add success/error toast notifications

### Phase 5: Testing & Validation

- [ ] **Task 5.1: Run all E2E tests**
  - Ensure all existing tests still pass
  - Verify new delete tests pass
  - Check for any regressions

- [ ] **Task 5.2: Manual testing**
  - Test with various org file formats
  - Test edge cases (malformed files, permission issues)
  - Test performance with large numbers of pins

- [ ] **Task 5.3: Code review and cleanup**
  - Remove commented-out code
  - Ensure consistent code style
  - Add proper JSDoc comments

### Phase 6: Commit & Documentation

- [ ] **Task 6.1: Commit changes**
  - Create meaningful commit message
  - Ensure all files are properly staged

- [ ] **Task 6.2: Update documentation**
  - Update README if needed
  - Update CHANGELOG with new feature

## Success Criteria

- [ ] E2E tests pass completely 
- [ ] Delete button appears on hover over pin items
- [ ] Clicking delete removes pin from UI immediately
- [ ] Org file is modified to remove pinned tag
- [ ] Incremental scan shows updated state
- [ ] No regressions in existing functionality
- [ ] Code is clean and well-documented 
