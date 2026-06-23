---
name: restart-dev
description: Cleanly restart the local Next.js dev server on this project (kill stray node processes, clear the .next cache, relaunch detached, verify http://localhost:3000 returns 200). Use whenever the dev server is stale/zombied, after a `next build` cleared/locked `.next`, or the user asks to restart localhost.
---

# Restart the dev server (clean)

This project's dev server gets reaped between turns and zombie `node` processes fight over the Turbopack `.next` cache. Always restart it the clean way, in ONE PowerShell call:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
if (Test-Path "$PWD\.next") { Remove-Item "$PWD\.next" -Recurse -Force -ErrorAction SilentlyContinue }
Start-Process cmd.exe -ArgumentList '/c','npm run dev > %TEMP%\lpdev.out.log 2>&1' -WindowStyle Hidden
Start-Sleep -Seconds 20
try { $r = Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing -TimeoutSec 50; "HTTP " + $r.StatusCode } catch { "fail: " + $_.Exception.Message }
```

Notes:
- Launch **detached** via `Start-Process` (harness background tasks get reaped between turns); logs go to `%TEMP%\lpdev.out.log`.
- First hit compiles `/` (Turbopack) — a 10–15s first-request delay is normal; use a generous timeout. If the first `Invoke-WebRequest` times out, wait ~10s and re-check before declaring failure.
- Report the final `HTTP 200` (or the error) to the user. Do NOT run `npx expo start` here — that's the mobile app.
