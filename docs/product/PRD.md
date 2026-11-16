# PocketOps Product Requirements Document (`PRD.md`)

## 1. Mission & Core Value Proposition
**Build, deploy, monitor, and respond to your applications — anywhere.**

PocketOps empowers software engineers, DevOps/platform teams, technical founders, and on-call responders to complete real production recovery workflows from Android without a laptop: inspecting incidents, checking health probes, reading Render logs, editing source code safely, opening PRs, confirming redeployments, verifying recovery, and resolving incidents with an auditable timeline.

## 2. Core Workflow
1. Receive push/inbox alert (`AC-01`) → inspect incident (`IN-03`).
2. Review linked service health (`SV-11`) and build/runtime logs (`SV-05`, `SV-06`).
3. Navigate to linked GitHub repository (`RP-02`..`RP-05`).
4. Edit code in CodeMirror 6 (`ED-01`) with encrypted offline drafts (`ED-05`).
5. Review diff (`ED-06`), resolve any remote SHA conflicts (`ED-07`), create fix branch (`GT-02`), commit (`GT-04`), and open PR (`GT-05`).
6. Confirm redeployment (`SV-08`), monitor rollout (`SV-09`), run recovery probe (`IN-08`), and explicitly resolve (`IN-09`).

## 3. Non-Goals (MVP)
- Arbitrary remote shell execution or SSH terminals.
- Automated AI code patching without explicit engineer review and commit confirmation.
- Full desktop IDE refactoring tools.
