# Hottt Probs merch pilot

The existing mobile merch interface, backed by a separate Google Apps Script project and a Google Sheet. This checkout is an isolated pilot: `config.js` points to Graham's pilot deployment. It does not contact the band's original backend. Replace that endpoint when making a separate installation.

## Development

Node 20+ is sufficient for all automated tests; there are no application dependencies.

```sh
npm run check
```

Run `npm run preview` for a local preview at http://127.0.0.1:4173. This serves only public app assets, excluding local Google credentials. Do not serve the entire repository with a generic static server. Deploy the public app assets to GitHub Pages when the real pilot backend has passed browser integration testing. A preview without a configured backend displays the locked setup screen.

- `index.html`, `app.js`: mobile interface.
- `config.js`: public environment label and backend endpoint; never credentials.
- `sync.js`: authenticated requests and durable pending actions.
- `apps-script/Inventory.js`: shared validation and inventory rules.
- `apps-script/Code.gs`: authentication, locking, and Sheet access.
- `tests/`: Node tests of rules, client failure recovery, and a simulated Apps Script environment.
- [Google setup and handoff](docs/SETUP.md).
- [Pilot acceptance checks](docs/PILOT.md).

## Behavior and scope

Edits require connectivity. Buttons wait for acknowledgment. Pending requests are stored synchronously in browser localStorage before sending, scoped to the exact backend URL, with no passphrase stored alongside them. Retry and reload reuse the same operation ID. Do not clear browser storage when a save is unconfirmed.

The passphrase remains in memory until locking or closing/reloading the page. Every API operation checks it on the server. Use a long random passphrase. This is simple shared-secret protection; it provides no individual attribution, account recovery, or robust protection from public-endpoint quota exhaustion.

Each accepted action is a single JSON row in an append-only Sheet log. Under a script lock, the server reconstructs stock, deduplicates the ID, validates the operation, appends one row, and flushes before acknowledging. Retrying after an ambiguous write checks the log first. There is no separately updated stock table that can fall out of sync. All writers must use this one script project; two projects accessing the same Sheet would have separate locks.

Voids reference unique sale IDs. Closing a gig creates a new gig ID while keeping prior events. Delayed actions for a closed gig are rejected and shown to the user. Export downloads the full log, which reconstructs inventory and gig history.

The pilot reads/replays the full log on each request. Reads do not take the write lock, and a successful edit uses the authoritative state returned by that write instead of making a second request. The app refreshes when unlocked, when it returns to the foreground, when connectivity returns, or when someone taps **Sync now**; it does not poll in the background. This deliberately favors auditability and usable write latency over instant passive updates. Do not edit the Events sheet directly. Keep exports before migration and after each gig, and measure latency and quota use before relying on it for many gigs.

## Verification status

Automated tests use fake network/storage and a simulated Google runtime. They do not prove Apps Script authorization, real Sheets durability, browser CORS/redirect behavior, or latency. Complete `docs/PILOT.md` against your own deployed backend before recording real merch sales.
