# Northstar UI audit

## Structural findings

- The authenticated workspace is concentrated in a single 2,100+ line route component with dozens of inline route conditions.
- `app/globals.css` is over 240 KB and contains repeated shell, card, typography, route visibility, and responsive declarations.
- Route visibility historically depended on a blanket `display:none` rule plus scattered page allowlists. This caused the Real Estate implementation to exist but remain invisible.
- Several later CSS files override earlier shell rules, making visual behavior depend on import order rather than component contracts.
- Operational pages mix serif marketing typography with very small dashboard metadata.
- Cards, tabs, headers, tables, form controls, empty states, and status treatments are duplicated rather than composed from primitives.

## Migration contract

1. Preserve APIs and financial calculations while extracting route surfaces from `northstar-workspace.tsx`.
2. Use the authoritative tokens in `design-system.css`; new components must not introduce raw brand colors when a semantic token exists.
3. Compose route surfaces from `AppPanel`, `SectionHeader`, `MetricCard`, `EmptyState`, and `StatusBadge`.
4. Replace CSS-only route visibility with conditional React route surfaces as each route is extracted.
5. Migrate in this order: shell and route visibility, Real Estate, Accounts, Household/Cash Flow/Debt, Markets/Charts, Portfolio/Advisor, Academy/Simulator, Settings/Auth.
6. Validate 1920, 1440, 1280, 1024, 768, 430, 390, 375, and 320 widths after each route migration.

## Acceptance checks

- Fixed full-height desktop rail and mobile drawer with no horizontal overflow.
- Consistent page origin, maximum width, gutters, section gap, title hierarchy, controls, and focus styles.
- Every route has visible loading, empty, error, and disabled states.
- Tables and charts retain usable controls and labels at tablet/mobile widths.
- No route relies on an undocumented visibility exception.
