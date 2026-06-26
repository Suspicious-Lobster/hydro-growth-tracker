# Hydro Growth Tracker — Frontend

The React 18 + Vite + Tailwind CSS frontend for Hydro Growth Tracker. It is
served at `http://localhost:5173` in development and built to `dist/` for the
packaged Electron app.

It talks to the embedded backend at `http://localhost:5000` (configurable via
the `VITE_API_BASE_URL` environment variable at build time).

## Scripts

```bash
npm install      # Install dependencies
npm run dev      # Start the Vite dev server
npm run build    # Build to dist/
npm run lint     # Run ESLint
```

> Normally you don't run these directly — use `npm run dev` / `npm run dist`
> from the project root, which orchestrate the frontend and the Electron shell
> together. See the root [README](../README.md).
