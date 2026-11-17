# Signalframe Design Tokens & Relay Brand Scope (`DESIGN_TOKENS.md`)

## Signalframe Light Mode
- `canvas`: `#F3F6F5`
- `surface`: `#FFFFFF`
- `surfaceSubtle`: `#F8FAFA`
- `bannerMuted`: `#E8EFF0`
- `border`: `#C8D5D8`
- `textPrimary`: `#192B32`
- `textSecondary`: `#526870`
- `primary`: `#236C7B` (`onPrimary`: `#FFFFFF`)
- `verified`: `#246C4B` (`verifiedBg`: `#DDEFE5`)
- `warning`: `#86501D` (`warningBg`: `#F9ECDC`)
- `critical`: `#A52F2A` (`criticalBg`: `#FCE8E6`)
- `info`: `#315F91` (`infoBg`: `#E3ECF5`)

## Signalframe Dark Mode
- `canvas`: `#10191F`
- `surface`: `#18252D`
- `codeSurface`: `#121D24`
- `bannerMuted`: `#21313A`
- `border`: `#344750`
- `textPrimary`: `#E8EFF0`
- `textSecondary`: `#A5B7BE`
- `primary`: `#8BC7D1` (`onPrimary`: `#10191F`)
- `verified`: `#8EC8AC` (`verifiedBg`: `#10252B`)
- `critical`: `#F09B91` (`criticalBg`: `#301A1B`)

## Relay Brand Conflict Resolution
- Relay brand colors (`#0B1F36`, `#FF7A59`, `#00D4B3`, `#F5F7FA`) are restricted to launcher icons, splash screen, Welcome hero (`ON-01`), and About (`ST-12`) so they never conflict with Critical (`#A52F2A`) or Verified (`#246C4B`) operational telemetry.

## Measured reference geometry (audit)

ON-01 and HM-01 screen SVGs use a 393 × 852 canvas, 18 px left inset, a 50 × 34 header mark with 8 px radius, and a banner starting at x=18, y=103 with width 342 and radius 15. ON-01 banner height is 144; HM-01 banner height is 120. Their example outlined cards have 66 px height and 11.5 px radius on the stroked rectangle. Component primary and secondary exports are 360 × 64 with 10 px radius; do not assume these sheet canvas dimensions are the in-screen button dimensions. All figures are SVG coordinates, not validated device-independent sizes. Text is outlined; font family, weight, and precise typographic metrics cannot be extracted from SVG text attributes.
