# LinuxDocs

An MDN-style reference for Linux commands plus a CTF security & hacking tools section.

## Stack
- Vite
- React 19
- TypeScript
- Tailwind CSS v4 (with `@tailwindcss/vite` plugin and `@import "tailwindcss";` in `src/index.css`)
- React Router DOM (`react-router-dom`)
- Fuse.js (`fuse.js`)

## Folder Layout
- `src/`
  - `data/commandBuilders.ts` — interactive builder specs (UI tool; command docs come from the authed API, source of truth is `backend/data`)
  - `components/` — Layout, Header, Sidebar, CommandCard, TerminalSimulator, CommandPalette, etc.
  - `pages/` — LandingPage, CategoryPage, CommandDetailPage, CTFHomePage, CTFDomainPage, NotFoundPage
  - `App.tsx` — Main router and layout wrapper
  - `index.css` — Tailwind v4 import and custom CSS variables / design tokens
  - `main.tsx` — React entry point

## Run Commands
- `npm install` — Install dependencies
- `npm run dev` — Start Vite dev server
- `npm run build` — Typecheck and build (`tsc -b && vite build`)
- `npm run lint` — Run oxlint
- `npm run check:links` — Run link validator script over the compiled `backend/data/commands.json`

## Design Tokens & Theme
- **Terminal Theme (Dark Default):** Near-black backgrounds (`#0a0f0d`), terminal green accent (`#00ff9c`), amber warnings (`#ffb86c`), red/black accent for CTF (`#ff5555`).
- **Light Terminal Theme (Paper-white):** Paper white backgrounds, dark mono text, clean contrast.
- **Fonts:** JetBrains Mono for code & headings, clean sans for body.
- **Persistence:** Theme preference stored in `localStorage` with zero flash on load.

## Rule
- **Verify by running before reporting done.**
