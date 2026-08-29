# User Management Specification

## Purpose

Admin user management with "last active admin" protection rule.

## Requirements

### Requirement: Last Active Admin Protection

The system SHALL prevent deactivation of the last active admin user. `UserService` SHALL query `COUNT(*) WHERE rol='admin' AND activo=1` and block deactivation when count equals 1.

#### Scenario: Deactivation blocked when last admin

- GIVEN exactly one active admin exists
- WHEN an attempt is made to deactivate that admin
- THEN the service rejects the deactivation AND returns an error

#### Scenario: Deactivation allowed with multiple admins

- GIVEN two or more active admins exist
- WHEN an admin is deactivated
- THEN the deactivation succeeds AND the user becomes inactive

### Requirement: Admin UI Deactivation Guard

The `AdminPage` SHALL disable deactivation controls when only one active admin remains. The UI SHALL display a warning message explaining the restriction.

#### Scenario: UI disables button for last admin

- GIVEN exactly one active admin exists
- WHEN the admin list renders in `AdminPage`
- THEN the deactivation button for that admin is disabled

#### Scenario: UI allows deactivation with multiple admins

- GIVEN two or more active admins exist
- WHEN the admin list renders in `AdminPage`
- THEN deactivation buttons are enabled for all admins

### Requirement: UserService Active Admin Count

`UserService` SHALL expose a method to count active admin users. The count SHALL reflect real-time database state.

#### Scenario: Count reflects current state

- GIVEN the database contains 2 active admins and 1 inactive admin
- WHEN the active admin count is queried
- THEN the result is 2

#### Scenario: Count updates after deactivation

- GIVEN the database contains 2 active admins
- WHEN one admin is deactivated
- THEN the active admin count becomes 1
