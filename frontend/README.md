# ClauseCheck — Lavender and Dusk

One React + TypeScript + Vite frontend with both supplied palettes. Lavender is the first-visit default. The sun/moon switch at the extreme right of the navbar selects Dusk or Lavender and saves only the theme preference in browser localStorage.

## Run

Stop the previous server (Ctrl+C), back up your current frontend, then replace it with this extracted frontend folder. From your main project folder:

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Requires Node 22.12+ or Node 24. Backend is not needed at this checkpoint.

## Layout

The original content, section spacing, typography and 860px content breakpoint are retained. On wide screens the switch sits in the navbar's far-right gutter outside the original centred navigation container. On narrower screens the navbar reserves room for the switch; navigation alone uses a menu below 1201px to avoid overlaps. Both themes share identical markup.

## Check

Switch themes, reload to check persistence, test the mobile menu and its Review button, navigate to sections and toggle the example highlight. The Review buttons still show the preview message until upload integration is added. Google Fonts needs internet access, as before.

TypeScript and production build were checked. Browser visual comparison still needs local confirmation.
