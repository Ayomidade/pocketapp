# Signalframe Figma Screen Map (`FIGMA_SCREEN_MAP.md`)

All 83 Signalframe frames (Light & Dark variants) were inspected from the supplied SVG archives and mapped directly to PocketOps Expo Router screens:

| Signalframe Group | Frame Range | Mobile Route | Coverage Status |
| :--- | :--- | :--- | :--- |
| Onboarding & Auth | `ON-01` .. `ON-10` | `/(auth)/welcome`, `/(onboarding)/setup` | Mapped |
| Home & Search | `HM-01` .. `HM-06` | `/(tabs)/index`, `/search` | Mapped |
| Projects | `PJ-01` .. `PJ-06` | `/(tabs)/projects`, `/projects/[id]` | Mapped |
| Repositories | `RP-01` .. `RP-07` | `/repositories/index`, `/repositories/[id]` | Mapped |
| Code Editor | `ED-01` .. `ED-07` | `/editor/index` | Mapped |
| Git Operations | `GT-01` .. `GT-08` | `/repositories/[id]`, `/editor/index` | Mapped |
| Services & Health | `SV-01` .. `SV-12` | `/(tabs)/services`, `/services/[id]` | Mapped |
| Incidents | `IN-01` .. `IN-10` | `/(tabs)/incidents`, `/incidents/[id]` | Mapped |
| Alerts & Activity | `AC-01` .. `AC-05` | `/(tabs)/inbox`, `/(onboarding)/setup` | Mapped |
| Account & Settings | `ST-01` .. `ST-12` | `/settings/index` | Mapped |

*Note*: Supplied archives contain flattened vector SVGs identified by Signalframe frame codes (`ON-01`..`ST-12`) without raw `.fig` node-ID strings or prototype JSON.
