# Tech Stack

- React 19 + TypeScript. Keep source in `src/`. Use the `@/` path alias.
- TanStack Start (Vite). Do not use Next.js, Remix, or React Router APIs.
- TanStack Router with **file-based routing** in `src/routes/`. The home page is `src/routes/index.tsx`. The only root layout is `src/routes/__root.tsx` — always keep `<Outlet />`.
- Do **not** create `src/pages/`, `src/App.tsx` routes, or `app/layout.tsx`. Dynamic segments use `$id` (not `[id]`). Layout routes use `_layout.tsx`. Never edit `src/routeTree.gen.ts`.
- Tailwind CSS v4 (`src/styles.css`). Style with Tailwind classes. Combine class names with `cn()` from `@/lib/utils`.
- shadcn/ui (New York) lives in `src/components/ui/` and is already installed with all Radix primitives. Import from those files; do not edit them — wrap or add new components in `src/components/` instead.
- TanStack Query is wired in `src/router.tsx` and provided in `__root.tsx`. Use it for server/async data; keep simple local UI state in React `useState`.
- Package manager: Bun (`bun.lock`). Vite config comes from `@lovable.dev/vite-tanstack-config` — do not re-add plugins that are already bundled there.

# Libraries — what to use when

- **UI primitives:** shadcn/ui + Radix. Prefer `Button`, `Input`, `Select`, `Dialog`, `Sheet`, `Table`, `Card`, `Tabs`, `Form`, etc. over raw HTML when building product UI.
- **Icons:** `lucide-react` only.
- **Forms:** `react-hook-form` + `zod` + `@hookform/resolvers` + shadcn `Form`. Do not invent a parallel form library.
- **Toasts:** `sonner` via the existing shadcn `Toaster` (`src/components/ui/sonner.tsx`).
- **Dates:** `date-fns` for formatting/parsing; `react-day-picker` + shadcn `Calendar` for date picking.
- **Charts:** `recharts` + shadcn `Chart`.
- **PDF export:** `jspdf` + `jspdf-autotable` (used by the daily schedule).
- **Carousel / command palette / drawer / OTP / resizable:** `embla-carousel-react`, `cmdk`, `vaul`, `input-otp`, `react-resizable-panels` — only through the matching shadcn wrappers.
- **Styling helpers:** `class-variance-authority`, `clsx`, `tailwind-merge`. Do not add another CSS-in-JS or utility-class library.
- **Links and navigation:** TanStack Router `Link`, `useNavigate`, `createFileRoute`. Never `react-router-dom`.
