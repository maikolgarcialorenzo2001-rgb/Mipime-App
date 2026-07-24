# Login Specification — Bug Fixes Delta

## ADDED Requirements

### Requirement: Body sin scrollbar horizontal

El `<body>` DEBE tener `overflow-x: hidden` para prevenir scroll horizontal en todas las páginas.

#### Scenario: Login en viewport estrecho

- GIVEN la página de login cargada en un viewport de 375px
- WHEN se renderiza el formulario
- THEN no aparece scrollbar horizontal
- AND todo el contenido es visible sin desplazamiento horizontal

#### Scenario: Login en desktop

- GIVEN la página de login cargada en un viewport de 1920px
- WHEN se renderiza el formulario
- THEN no aparece scrollbar horizontal
