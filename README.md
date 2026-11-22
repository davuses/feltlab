# FeltLab — 6-Max Texas Hold'em Mastery Studio

**FeltLab** is an interactive 6-max 100bb No-Limit Texas Hold'em training studio designed to replace table guesswork with deliberate, solver-grounded repetition. Practice preflop ranges, postflop decision trees, pot odds & EV math, multi-street hand reading, and full hands against configurable strategic bots on an interactive 3D casino poker table.

---

## Core Features

- **Preflop Range & Position Lab** — 6-max 100bb RFI, 3-bet, and 4-bet defense drills with an interactive 169-hand mixed-strategy GTO matrix, solver frequency breakdowns, and EV loss grading.
- **Postflop Live-Table Trainer** — Flop, turn, and river single-raised and 3-bet pot spots graded against solver frequencies, nut/range advantage, blockers, and concise strategic takeaways.
- **Pot Odds, Equity & EV Math Lab** — Exact turn equity, required equity, call EV (in big blinds), bluff break-even %, and Minimum Defense Frequency (MDF) drills.
- **Hand Reading & Range Narrowing** — Paint Villain's surviving range onto a 13×13 matrix street-by-street and score combo overlap against equilibrium.
- **Configurable Multi-Bot Practice Arena** — Play complete cash hands against up to 5 distinct bot archetypes (*Balanced Reg, TAG, LAG, Calling Station, Nit*) with customizable table size (Heads-Up to 6-Max), stack depths, Hero position lock, live HUD stats, Blind Read mode, Fast-Fold, street-by-street EV audits, and **Theater / Fullscreen Mode**.
- **Interactive 3D High-Stakes Poker Studio** — Custom Three.js PBR casino table featuring mahogany racetrack trim, stitched leather rail, switchable speed-cloth felt themes, studio/daylight/lounge lighting presets, animated card dealing & chip-tossing physics, toggleable lounge props, and 4 camera angles.
- **Mastery & Leak Tracker** — Aggregates accuracy, EV loss per spot, streaks, and leak breakdown across all drills with local persistence and optional Google Sign-In cloud sync via Firebase Firestore.
- **Bilingual Support** — Instant toggle between **English (`en`)** and **Simplified Chinese (`zh-CN`)**.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **3D Engine:** Three.js (procedural canvas textures, PBR lighting, instanced clay chips, parabolic deal/bet tweens)
- **Cloud Sync (Optional):** Firebase Authentication (Google Sign-In) & Cloud Firestore

---

## Local Development

### Prerequisites
- Node.js 20+ (Node 22 recommended)

### Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Type-check with TypeScript
npm run lint

# Run unit tests (poker engine, i18n parity, Firestore rules spec)
npx tsx --test src/poker/engine.test.ts src/i18n/translations.test.ts firestore.rules.test.ts

# Build static production bundle into dist/
npm run build

# Preview production build locally
npm run preview
```

---

## Deployment

FeltLab builds into a pure static Single-Page Application (`dist/`) with relative asset paths (`base: './'`), ready for GitHub Pages or Firebase Hosting.

### Option 1: GitHub Pages (Automated via GitHub Actions)
This repository includes `.github/workflows/deploy-pages.yml`.

1. Push your repository to GitHub (`main` or `master` branch).
2. In your GitHub repo, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Wait for the **Deploy FeltLab to GitHub Pages** workflow in the **Actions** tab to finish.
4. *(Optional for Cloud Leak Sync)* Add `<your-username>.github.io` under **Firebase Console → Authentication → Settings → Authorized domains**.

### Option 2: Firebase Hosting
This repository includes `firebase.json` and `.firebaserc`.

```bash
npm install
npm run build
npx firebase-tools login
npx firebase-tools deploy --only hosting
```

### Embedding in Google Sites
1. Open [sites.google.com](https://sites.google.com).
2. Go to **Pages** → hover **`+`** → **Full page embed** → **Add embed → By URL**.
3. Paste your live GitHub Pages or Firebase Hosting URL and click **Publish**.

---

## Keyboard Shortcuts (3D Table & Bot Arena)

| Key | Action |
| :--- | :--- |
| `1` – `4` | Switch camera presets (*Hero POV, Broadcast, Top-Down, Pot Close-Up*) |
| `H` | Show / hide 3D studio controls dock |
| `P` | Toggle ambient lounge props (crystal whiskey tumbler & gold card protector) |
| `Esc` | Exit Bot Arena Theater Mode |
