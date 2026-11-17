# Visual QA audit

- Reference viewport: 393 × 852; the 166 screen SVGs have this canvas.
- SVGs are flattened vector outlines; no font family or editable text metadata is present in the supplied exports. Font identification and licensing remain unverified.
- The app was run on a connected Android device earlier in this session, but its screenshots contained live account data and are not used as comparison artifacts. The phone was temporarily offline during this audit. No current state-matched screenshots were captured.
- A local Android emulator exists; no isolated non-production preview mode was found. Do not point screenshots at production data.
- The live Figma design-context request was blocked by the Starter plan MCP call limit. Local SVGs were accessible and rendered in earlier work.
- No pixel-perfect or completed-screen claims are made. Align reference and implementation to the same viewport, theme, state, font scale, and safe area; record screenshot and overlay paths before marking a screen verified.
- Validate light/dark, accessibility scaling, keyboard, navigation, and error states separately; automated tests do not prove visual fidelity.

- Audit checks: mobile lint and tests passed (3 suites, 5 tests); server lint and tests passed (3 suites, 12 tests). These checks do not verify screenshots or live integrations.
- Source-level ON-01 and HM-01 findings are preliminary, not state-matched screenshot comparisons. All 83 screens remain pending visual verification.

## Isolated preview (in progress)

From `mobile/`, run `EXPO_PUBLIC_DESIGN_PREVIEW=true EXPO_PUBLIC_DESIGN_SCREEN=dashboard EXPO_PUBLIC_DESIGN_THEME=light npx expo start --dev-client --port 8082`. Set the screen to `welcome` or `dashboard` and the theme to `light` or `dark`, and restart Metro when changing these values. The preview is compiled only in development mode, does not mount the session navigator, uses example data and disables navigation actions. A connected debug build must be pointed at that server. Do not use a production session for visual captures.

The initial shared context-card and navigation changes and the ON-01/HM-01 layouts are in progress. Mobile lint and tests pass; no updated matching screenshots have yet been captured, so visual validation and light/dark verification remain pending.

## Device comparison — 2026-11-17

Captured ON-01 and HM-01 on the connected Samsung SM-A042F with the isolated fixture preview. System font scale was 1.3; the 720 × 1600 physical display and preview label do not match the 393 × 852 reference canvas. Screenshots are cropped to remove system bars and are in `visual-qa/` (the light dashboard capture includes a transient refresh spinner). All displayed operational values are fixture data.

- ON-01: both themes show the reference-like hero, three context cards and left-aligned primary action. The larger font and longer real explanatory copy increase card heights. The reference example footer and navigation differ from the unauthenticated screen, which retains a secure sign-in footer and no signed-in navigation.
- HM-01: both themes show the hero, context cards, action and navigation. Reference copy and sample values differ from the live-data bindings; search/settings and operational summaries remain available below the main action. The navigation is pinned to the safe area whereas the reference shows it below the footer. The header action buttons initially forced the title to wrap; they were moved below the main action.
- The device captures establish a preliminary enlarged-font comparison only; normal-font 393 × 852 captures, matching-state overlays, actual sign-in/operation tests and formal accessibility verification remain outstanding. Do not mark either screen verified.
