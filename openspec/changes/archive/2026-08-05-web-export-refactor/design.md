# Design: web-export-refactor

## Technical Approach

Two independent backlogs, one PR, two work-unit commits. B5 (revoke deferral) is a
pure web-robustness fix with no build risk; B6 (single-source export name) introduces
a web→electron cross-directory import that carries the only build risk. Do B5 first
(independent, de-risks the cargo), then B6 with an upfront import probe. TDD RED at
every site. Mapping to proposal: B5 both blob sites wrapped in `setTimeout(..., 0)`;
B6 pure `electron/export-name.ts` shared by desktop + web.

## Architecture Decisions

### Decision: B6 exit-common helper location & import wiring (risky)
**Choice**: `electron/export-name.ts` primary, with a probe-gated comment-linked
duplicate fallback.
**Rationale**: `electron/main.ts` (CommonJS, `rootDir:"."`) can only import within
`electron/`. Web `backup.service.ts` can import outside `src` (no rootDir; esbuild +
`@analogjs` compile transistor languages). Keeping logic in `electron/` avoids the
terminal `rootDir:".."` change that re-nests emit and breaks electron-builder.
**Resolve-HOW (primary)**: real import
`src/app/services/backup.service.ts` → `../../../electron/export-name`.
**Fallback if probe RED**: keep logic in `electron/export-name.ts` (desktop); web gets
`src/app/services/export-name.const.ts` that duplicates the const with a header comment
"single-source owner: electron/export-name.ts — keep byte-identical" + residual-drift
risk note. The duplicate is the LAST resort, chosen only on probe failure.

### Decision: build-import probe (verify FIRST, before finalizing call-sites)
**Choice**: Run `ng build` as the authoritative gate the instant both call-sites are
switched to the real import. If GREEN → real import stays. If RED → swap to the
comment-linked duplicate fallback.
**Rationale**: web vitest (`vitest.config.ts`) runs with `disableTypeChecking: true`
and only indexes `src/**/*.spec.ts`, so it cannot serve as the gate; `ng build` is the
first type-checks and bundles the cross-dir file.
**Residual**-drift risk on fallback: noted in the doc comment; mitigated by keeping the
owner file law and the shared REGEX comment.

### Decision: spec/spec-runner placement
**Choice**: helper spec lives at `electron/export-name.spec.ts`.
**Rationale**: web runner (`src/**`) won't pick it; electron runner
(`electron/**/*.spec.ts`, node env) picks it. The helper is framework-free with no
electron imports, so a plain function spec executes fine under the node runner (just
slower than web — acceptable).

### Decision: deferred revoke code shape (B5)
**Choice**: at `backup.service.ts:60` and `electron-file.service.ts:95` replace the
sync call with `setTimeout(() => URL.revokeObjectURL(url), 0);`. Fake timers are the
mechanism: `vi.useFakeTimers()` + `vi.advanceTimersByTime(0)`.
**Rationale**: defers revoke past the already-initiated click task. No pending-destroy
risk: timer is a background revoke of an already-clicked URL; if not fired it leaks
one blob URL (benign), and test teardown resets timers before it runs.
**Assertions**: after `click()` revoke NOT called synchronously; after
`advanceTimersByTime(0)` called exactly once.

### Decision: eslint coverage (B6)
**Rationale**: `ng lint` (angular-eslint builder) scans only `src/**`, same as every
other `electron/*.ts` today — no config change, matches existing convention.
`no-explicit-any:error` is satisfied (no `any` in helper).

## Architecture Decisions (tabular)

| # | Decision | Option | Decision |
|---|----------|--------|----------|
| D1 | Helper location | electron/ | electron/export-name.ts |
| D2 | Web import | cross-dir vs duplicate | primary cross-dir `../../../electron/export-name` |
| D3 | Build gate | vitest(no typecheck) vs ng build | `ng build` probe first |
| D4 | Spec placement | web vs electron runner | electron/helper.spec.ts (electron runner) |
| D5 | Revoke mechanism | sync vs setTimeout(0) | setTimeout(...,0) + fake timers |

## Data Flow

```
 exportName(d: Date): string            // electron/export-name.ts (pure)
    ├── electron/main.ts  db:export defaultPath (CJS, ./export-name)
    └── backup.service.ts a.download     (web, ../../../electron/export-name)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `electron/export-name.ts` | Create | Pure `exportName(d)` → `tienda_export_YYYYMMDD_HHmm.db` |
| `electron/export-name.spec.ts` | Create | RED unit tests (zero-pad, format) — electron runner |
| `electron/main.ts` | Modify | L55-61 delete local `exportName`; import `./export-name` |
| `src/app/services/backup.service.ts` | Modify | L60 defer revoke; L67-72 use shared `exportName`, delete `_webExportName` |
| `src/app/services/electron-file.service.ts` | Modify | L95 wrap revoke in `setTimeout(...,0)` |
| `src/app/services/backup.service.spec.ts` | Modify | RED deferred-revoke test, L119-152 |
| `src/app/services/electron-file.service.spec.ts` | Modify | RED deferred-revoke test, L65-81 |
| `src/app/services/export-name.const.ts` | Create (only if probe RED) | fallback dup const w/ source comment |

## Interfaces / Contracts

```ts
// electron/export-name.ts
export function exportName(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `tienda_export_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.db`;
}
```

Byte-identical to the two current sites (verified in explore #467).

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | export helper zero-pad + format | new electron spec (electron runner) |
| Unit | backup revoke deferred | fake timers: not sync after click; fires once after advance |
| Unit | electron-file revoke deferred | fake timers, spy + advance×0 calls once with 'blob:url' |
| Runner | helper isolation | electron runner only (web excludes electron/**) |

## Migration / Rollout

No migration.Feature-free pure refactor; fallback duplicate (if probe fails) carries
one comment note. Rollback: revert the 2-commit PR.

## Open Questions

None blocking. Residual: fallback drift risk only if probe RED (mitigated by comment).

## Implementation Order

1. **B5** (independent, no build risk):
   RED backup.service.spec + electron-file.service.spec (deferred revoke) →
   implement setTimeout at both sites → green web + electron runners.
2. **B6** (after 5):
   - RED `electron/export-name.spec.ts` → implement `electron/export-name.ts` (electron runner).
   - `electron/main.ts` → `./export-name`.
   - **PROBE** `ng build` with web import; if GREEN keep real import; if RED create
     `export-name.const.ts` duplicate + comment.
   - `backup.service.ts` → shared `exportName`, delete `_webExportName` + legacy
     web spec → green.
3. Commits: B5 work-unit, then B6 work-unit. Single PR under 400 lines.