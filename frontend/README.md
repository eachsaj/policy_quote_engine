# PolicyQuote frontend

Angular 22 single-page quote form (standalone, zoneless, OnPush, signals, Reactive Forms, hand-written CSS).

```bash
npm install
npm start        # ng serve on http://localhost:4200; /policy and /health are proxied to the backend on :3000 (proxy.conf.json)
npm test         # Vitest via ng test
npm run lint     # angular-eslint: no any, no Subject/BehaviorSubject imports, signal inputs
npm run build    # production build to dist/frontend
```

Start the backend first (`npm --prefix ../backend start`). See the repository root for the full picture.
