# Newton demo app

Fill `demo-config.json` from `client-handoff.json`. Inject `NEWTON_API_KEY`
into `.env.local` (never `NEXT_PUBLIC_*`).

```bash
cp .env.example .env.local
npm install
npm run dev
```

The connected wallet is `intent.from` and later `msg.sender`. Evaluation
runs on `POST /api/evaluate`. On deny, the app does not send a transaction.
