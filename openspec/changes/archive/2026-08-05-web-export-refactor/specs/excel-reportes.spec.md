# Delta for excel-reportes

## ADDED Requirements

### Requirement: Blob download revoke is deferred past the click

When a download is triggered via a temporary `URL.createObjectURL` blob anchor, the system MUST NOT revoke the object URL synchronously in the same tick as `a.click()`. The revoke SHALL be deferred via a `setTimeout(..., 0)` callback so the browser finishes initiating the download before the URL is revoked.

#### Scenario: Web backup export — revoke deferred (backup.service.ts)

- GIVEN a web manual export creates an object URL for the backup file and fakes timers
- WHEN `a.click()` is invoked on the download anchor
- THEN `URL.revokeObjectURL` MUST NOT have been called synchronously immediately after the click
- AND the download anchor's href/blob URL is still valid while the download proceeds
- AND after advancing timers by `0` (e.g., `vi.advanceTimersByTime(0)`) the revoke IS called exactly once

#### Scenario: Excel blob-fallback download — revoke deferred (electron-file.service.ts)

- GIVEN the blob-fallback path creates an object URL for an Excel download and fakes timers
- WHEN `a.click()` is invoked
- THEN `URL.revokeObjectURL` is NOT called synchronously in the same tick
- AND the blob URL remains valid through the click
- AND after advancing timed by `0` the revoke fires exactly once

## Constraints

- The shared fragile pattern (create → click → revoke) is addressed identically at BOTH sites: `backup.service.ts` and `electron-file.service.ts` `_blobFallback`.
- Deferral MUST be via `setTimeout(..., 0)`; the object URL MUST NOT be revoked before the click completes.