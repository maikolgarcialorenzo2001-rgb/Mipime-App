# Legacy Admin Reset Specification

## Purpose

Detect and force-reset legacy hardcoded admin passwords (`softwarez`, `admin123`) at runtime.

## Requirements

### Requirement: Legacy Password Detection

The system SHALL detect when a user authenticates with a legacy hardcoded password (`softwarez` or `admin123`) by verifying the stored hash against those values. Detection SHALL occur during session restore in `AuthService._restoreSession`.

#### Scenario: Legacy password detected on session restore

- GIVEN a user has a stored password hash matching `softwarez` or `admin123`
- WHEN `_restoreSession` runs during app startup
- THEN the system flags the session as requiring a forced reset

#### Scenario: Non-legacy password not flagged

- GIVEN a user has a stored password hash NOT matching legacy values
- WHEN `_restoreSession` runs during app startup
- THEN the session is restored normally without reset flag

### Requirement: Forced Reset One-Time

The system SHALL redirect flagged users to `/setup?mode=reset&userId=X` on first detection. A `config.legacy_reset_done` flag SHALL prevent repeated redirects.

#### Scenario: First-time legacy user forced to reset

- GIVEN a user with legacy password AND `legacy_reset_done` is not set
- WHEN the app starts and detects the legacy hash
- THEN the user is redirected to `/setup?mode=reset&userId=X`

#### Scenario: Reset flag prevents re-trigger

- GIVEN a user with `legacy_reset_done=true` in config
- WHEN the app starts
- THEN no redirect to reset occurs

### Requirement: Reset Flow on Setup Page

The setup page SHALL support `mode=reset` query parameter to display a password reset form. The user MUST set a new password before accessing the application.

#### Scenario: Reset form displayed for legacy user

- GIVEN the setup page is loaded with `?mode=reset&userId=1`
- WHEN the page renders
- THEN a password reset form is shown for the specified user

#### Scenario: New password required before proceeding

- GIVEN the reset form is displayed
- WHEN the user submits without entering a new password
- THEN the form rejects the submission with validation error
