# Newton demo app

Fill `demo-config.json` from `client-handoff.json`. Inject `NEWTON_API_KEY`
into `.env.local` (never `NEXT_PUBLIC_*`). Ethereum Sepolia RPC defaults to
`https://ethereum-sepolia-rpc.publicnode.com` if `NEXT_PUBLIC_RPC_URL` is
unset.

```bash
cp .env.example .env.local
npm install
npm run dev
```

The connected wallet is `intent.from` and later `msg.sender`. Evaluation
runs on `POST /api/evaluate`. On deny, the app does not send a transaction.
