# Component mapping audit

| Reference | Current implementation | Audit status |
|---|---|---|
| Button / Primary | `mobile/src/components/Buttons.js` — `PrimaryButton` | Present; measure against reference and verify states |
| Button / Secondary | `mobile/src/components/Buttons.js` — `SecondaryButton` | Present; measure against reference and verify states |
| Status / Critical, Verified, Unknown | `mobile/src/components/StatusBadge.js` | Present; verify variants and state semantics |
| Connection / Unlinked, Draft / Local, Operation / Pending | `mobile/src/components/StatusBadge.js` | Present as mappings; compare component artwork and colors |
| Shared header | `mobile/src/components/ModuleHeader.js` | Present; compare header geometry and back/action variants |
| Cards and banners | `mobile/src/components/SignalCard.js` | Present; verify content-dependent sizing and theme variants |
| Bottom navigation | `mobile/app/(tabs)/_layout.js` | Custom text navigation; verify geometry, safe area and scaling |
| Loading, empty, error | `mobile/src/components/StateViews.js` | Present; compare each state |
| Framework-neutral foundations | `mobile/src/theme/tokens.js`, `mobile/src/theme/ThemeProvider.js` | Partially extracted; outlined text prevents direct font identification |
| React Native + Kotlin parity | No Kotlin implementation in `mobile/` | Handoff reference; verify behavior against JS implementation |

The reference component artwork uses unlinked `#FFF2DF` / `#86501D`, local draft `#E8EFF0` / `#192B32`, and pending `#E8EFF0` / `#192B32`. The current badge mappings use unknown, info, and warning token variants respectively. Confirm semantic and dark-mode treatments against the screen references before changing them.
