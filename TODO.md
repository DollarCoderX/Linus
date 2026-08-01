# Adaptive Interface Modes — Implementation Plan

## Steps

### Step 1: Update Shared Types
- [x] **File:** `src/shared/Linus.ts`
- [x] **Changes:**
  - Add `'expanded'` | `'workspace'` to `LinusWindowMode`
  - Add `WorkspaceItem` and `WorkspaceSection` types
  - Add `sidebarPanel` to `LinusAppState`
  - Update `LinusBridge` with new methods

### Step 2: Update Main Process
- [ ] **File:** `src/main/index.ts`
- [ ] **Changes:**
  - Add `EXPANDED_SIZE` and `WORKSPACE_SIZE` constants
  - Update `windowModes` to include new modes
  - Update `resolveInitialBounds` and `setWindowMode`
  - Add drag-to-top-edge detection for workspace mode
  - Add IPC handlers for workspace/sidebar operations

### Step 3: Update Preload Bridge
- [ ] **File:** `src/preload/index.ts`
- [ ] **Changes:**
  - Add new IPC method bindings for workspace mode

### Step 4: Update Renderer — App.tsx
- [ ] **File:** `src/renderer/src/App.tsx`
- [ ] **Changes:**
  - Add `ExpandedAssistant` component (Mode 2)
  - Add `DesktopWorkspace` component (Mode 3)
  - Add drag-to-top detection in floating assistant
  - Add shared element animations between modes
  - Add sidebar navigation for workspace mode

### Step 5: Update Styles
- [ ] **File:** `src/renderer/src/styles.css`
- [ ] **Changes:**
  - Add styles for expanded assistant
  - Add styles for desktop workspace (sidebar, center, toolbar)
  - Add transition animations
  - Add drag handle styles
