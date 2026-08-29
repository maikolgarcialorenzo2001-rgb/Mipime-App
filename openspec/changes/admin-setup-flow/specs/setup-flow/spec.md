# Setup Flow Specification

## Purpose

First-boot setup flow that replaces hardcoded admin credentials with a runtime setup page.

## Requirements

### Requirement: Setup Guard

The system SHALL redirect unauthenticated users to `/setup` when zero users exist in the database, and to `/login` otherwise. The guard SHALL prevent authenticated users from accessing `/setup`.

#### Scenario: Fresh install redirects to setup

- GIVEN no users exist in the database
- WHEN an unauthenticated user navigates to `/login`
- THEN the system redirects to `/setup`

#### Scenario: Existing install allows login

- GIVEN at least one user exists in the database
- WHEN an unauthenticated user navigates to `/login`
- THEN the system allows access to `/login`

#### Scenario: Authenticated user blocked from setup

- GIVEN at least one user exists in the database
- WHEN an authenticated user navigates to `/setup`
- THEN the system redirects to `/pos`

### Requirement: Setup Service

The system SHALL provide a `SetupService` that counts existing users and creates the initial admin account with `nombreComercio`. The service SHALL persist `nombreComercio` in the `config` table.

#### Scenario: Setup succeeds with valid data

- GIVEN no users exist in the database
- WHEN the setup form is submitted with valid admin credentials and business name
- THEN a new admin user is created AND `nombreComercio` is stored in `config`

#### Scenario: Setup blocked when users exist

- GIVEN at least one user exists in the database
- WHEN the setup form is submitted
- THEN the service rejects the request

### Requirement: Setup Page

The system SHALL provide a `/setup` page (standalone, following login page visual pattern) with form fields for admin credentials and business name. The page SHALL persist data via `SetupService` and redirect to `/pos` on success.

#### Scenario: Setup page renders correctly

- GIVEN the user is on `/setup`
- WHEN the page loads
- THEN a form with admin credentials and business name fields is displayed

#### Scenario: Successful setup redirects to POS

- GIVEN valid admin credentials and business name are entered
- WHEN the form is submitted
- THEN the user is redirected to `/pos` authenticated as admin

### Requirement: Config Table Migration v18

The system SHALL create a `config` table in migration v18 with columns for key-value settings. `MAX_SCHEMA_VERSION` SHALL be updated from 17 to 18.

#### Scenario: Fresh install creates config table

- GIVEN a fresh database installation
- WHEN migration v18 runs
- THEN the `config` table is created AND `MAX_SCHEMA_VERSION` equals 18

#### Scenario: Existing database upgrades to v18

- GIVEN an existing database at schema version 17
- WHEN migration v18 runs
- THEN the `config` table is created without data loss

### Requirement: Environment Credentials Removal

The system SHALL NOT contain hardcoded admin credentials in any environment file. All three `src/app/environments/*.ts` files SHALL have credentials removed. The `fileReplacements` shapes SHALL remain intact.

#### Scenario: Environment files contain no credentials

- GIVEN the three environment files
- WHEN inspected
- THEN no admin credentials are present AND `fileReplacements` configuration is valid

### Requirement: Optional Product Seed

The system SHALL provide an option in the setup form to enable or disable the product catalog seed. When enabled, the system SHALL seed the `productos` table only when it is empty, and SHALL NOT modify an existing catalog. The seed decision SHALL be persisted in the `config` table under the `seedProducts` key with value `'1'` (enabled) or `'0'` (disabled).

#### Scenario: Seed enabled on fresh install

- GIVEN no products exist in the database
- WHEN the setup form is submitted with the product seed enabled
- THEN the 74-product example catalog is inserted AND `config.seedProducts` is stored as `'1'`

#### Scenario: Seed disabled on fresh install

- GIVEN no products exist in the database
- WHEN the setup form is submitted with the product seed disabled
- THEN the `productos` table remains empty AND `config.seedProducts` is stored as `'0'`

#### Scenario: Seed does not overwrite existing catalog

- GIVEN products already exist in the database
- WHEN the setup form is submitted with the product seed enabled
- THEN the existing catalog is left unchanged
