t# Linus Parallel Multi-Tool Execution — Implementation Plan

## Phase 1: Shared Types & Brain
- [x] 1. `src/shared/linus.ts` — Add `ParallelTask`, `ToolExecutionResult` types, update `LinusTaskPreview`
- [x] 2. `src/main/tasks/toolPlanner.ts` — Rewrite to return `ToolPlanBatch` (array of up to 9 tools with priorities)

## Phase 2: Execution Engine
- [x] 3. NEW `src/main/tasks/parallelExecutor.ts` — Concurrent tool execution via `Promise.allSettled`
- [x] 4. NEW `src/main/tasks/taskOrchestrator.ts` — Groups tools into parallel batches & dependency chains, tracks lifecycle

## Phase 3: Tool Arsenal
- [x] 5. `src/main/tools/toolRegistry.ts` — Mark all implemented tools as ready
- [x] 6. `src/main/tools/desktopTools.ts` — Add multi-launch, multi-folder, multi-note intents

## Phase 4: Smart Routing
- [x] 7. `src/main/ai/router.ts` — Intelligence-aware routing (smart for planning, fast for summarization)

## Phase 5: Integration & UI
- [x] 8. `src/main/index.ts` — Replace sequential if-chain with orchestrator + parallel executor
- [x] 9. `src/renderer/src/App.tsx` — Render parallel task cards with live status
</｜｜DSML｜｜>
</create_file>
