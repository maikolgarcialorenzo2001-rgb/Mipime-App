# Delta for Login

## MODIFIED Requirements

### Requirement: Body sin scrollbar horizontal

El `<body>` DEBE tener `overflow-x: hidden` para prevenir scroll horizontal en todas las páginas.

(Previously: Only body overflow behavior — no guard or credential concerns)

#### Scenario: Login en viewport estrecho

- GIVEN la página de login cargada en un viewport de 375px
- WHEN se renderiza el formulario
- THEN no aparece scrollbar horizontal
- AND todo el contenido es visible sin desplazamiento horizontal

#### Scenario: Login en desktop

- GIVEN la página de login cargada en un viewport de 1920px
- WHEN se renderiza el formulario
- THEN no aparece scrollbar horizontal

### Requirement: Login Guard Redirection

The system SHALL redirect users based on database state when accessing `/login`. Fresh installs (zero users) SHALL redirect to `/setup`. Existing installs SHALL allow normal login flow.

#### Scenario: Fresh install bypasses login

- GIVEN zero users exist in the database
- WHEN a user navigates to `/login`
- THEN the system redirects to `/setup`

#### Scenario: Existing install allows login

- GIVEN at least one user exists in the database
- WHEN a user navigates to `/login`
- THEN the login page renders normally

### Requirement: No Hardcoded Credentials in Environment Files

The system SHALL NOT contain hardcoded admin credentials in any environment file. Credentials SHALL only exist in the database, created via the setup flow or legacy reset.

#### Scenario: Environment files are credential-free

- GIVEN the three `src/app/environments/*.ts` files
- WHEN inspected for credential values
- THEN no admin username or password values are present

#### Scenario: Login works without environment credentials

- GIVEN environment files have no credentials
- WHEN a user authenticates via the login form
- THEN authentication succeeds against database-stored credentials
