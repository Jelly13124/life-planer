# UI / visual identity

- **Apple-style white minimal theme** (current): off-white app bg, white cards, hairline gray borders, near-black text, very subtle shadows, system SF typography. Tokens live in `src/app/globals.css` (`--bg-*`, `--fg-*`, `--line`, `--accent`, …) — theme via CSS variables, not hardcoded colors.
- Brand accent is **violet** (darkened for AA contrast on white). The prediction tree / map sits on an intentional **dark "media panel"** (`.lp-media-dark`) inside the light app.
- **Icons are minimal line icons** (`src/components/ui/icons.tsx`) — currentColor stroke, NO emoji anywhere user-facing. Area icons via `src/components/lib/areaMeta.tsx` (`AreaIcon`, tinted by area color).
- Reuse shared primitives in `src/components/ui/` (Card/Button/SectionHeader/EmptyState). Keep their public props stable — many screens depend on them.
- Accessibility: real `<button>`/`<input>`/`<label>`, aria where needed, respect `prefers-reduced-motion`.
- Do NOT pixel-clone other products' proprietary UIs — build equivalent IA/function in our own design.
