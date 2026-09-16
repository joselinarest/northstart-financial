# Northstar mobile UX acceptance criteria

Primary phone viewports: 360x800, 390x844, and 430x932. Secondary verification: 768x1024 tablet and 1440x900 desktop.

## Shared shell

- Phone layouts show a fixed five-destination bottom navigation: Today, Portfolio, Markets, Finance, and Alerts.
- Secondary routes use the permission-aware drawer; the desktop sidebar does not remain visible on phones.
- Header, content, drawer, notification center, confirmation sheets, and bottom navigation respect iOS safe-area insets.
- Scrollable content ends above the bottom navigation and has no horizontal page overflow.
- Bottom-navigation controls and primary form controls provide at least a 44px touch area.

## Content and interaction

- Page headers are compact enough to expose useful data in the first phone viewport.
- Dense account, position, transaction, alert, and candidate tables render as vertical cards or rows on phones.
- Phone forms use a single-column flow, 44px controls, and 16px input text to prevent iOS zoom.
- Confirmations and notification dialogs render as bottom sheets on phones and restore their desktop modal treatment above the mobile breakpoint.
- Loading states remain visible while protected financial data is loading.

## Workflow checks

- Today: market state, account context, actionable count, and first recommendation are reachable without opening the drawer.
- Portfolio: account-specific holdings and analysis remain in the selected account group.
- Markets and candidates: cards wrap without clipping; detail routes remain directly navigable.
- Finance and transactions: rows do not require horizontal table scrolling; account and transaction actions remain touch-sized.
- Alerts: the bottom-navigation badge opens the notification center; notifications retain deep links and clear-all confirmation.
- Secondary navigation: opening and closing the drawer does not move or hide the bottom navigation.

## Release gate

- TypeScript passes.
- Production build passes.
- Mobile shell contains the safe-area bottom navigation and mobile bottom-sheet rules.
- Authenticated device testing must still be performed at every listed viewport before production release; authentication must never be bypassed to make visual testing easier.
