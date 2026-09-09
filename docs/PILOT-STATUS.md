# Pilot status — 2026-09-09

- Google owner: Graham's personal account.
- Script project: `1x9O7uoMQYcFj1rvijXcTAmxTH3rP32HXuof7FX5_VVChfGRASqWS5vEY`.
- Backend version: 1.
- Deployment: `AKfycby8JTgET0hRWaBfR935pdS3vCUEx3Rxlcomd5vmKg8Prb4dV9w5Yjbks14eSyW3C7aHZw`.
- Frontend: `https://grahamfindlay.github.io/hotttprobs/`.
- Published commit: `b7a7b7a0c19b0de11f2631dfda2eb0676ccf3e74` on `main`.
- Owner reports `setupPilot` completed and the passphrase is configured.
- All 25 automated tests pass.
- Real endpoint GET returns an authentication error without inventory.
- The in-app browser at `http://127.0.0.1:4173` can read the Google backend's JSON response to an incorrect passphrase. Google redirects and cross-origin POST work for this check.
- Real-browser testing caught an illegal invocation of native `fetch`. The client now invokes the injected fetcher as a function; a regression test covers the receiver.
- Authenticated loading works in the live browser. A sale reduced stock and appeared in the active sales log; voiding it removed the sale and restored stock. A stock adjustment changed inventory without adding a sale, and its reversing adjustment restored the starting count.
- GitHub Pages deployed successfully from the manual `Publish pilot to GitHub Pages` workflow. A fresh public page hid inventory, and an incorrect passphrase returned no data.
- Safari generated and downloaded `hp-inventory-2026-09-09.json`. A post-closeout export contained seven events, ended with a `close` event, contained no passphrase field, and replayed through `Inventory.replay` to 131 items and zero active sales, matching the live app.
- The owner explicitly approved the live closeout test. Closing the sample gig cleared its one active sale for everyone and preserved the resulting stock count of 131. Prior activity remained in the export.
- Locking the public app hid both inventory totals and the active-sales view and cleared the in-memory authenticated session.
- Concurrent real browsers, actual phone testing, failure/retry cases, clipboard behavior, and a copied-Sheet handoff rehearsal remain pending.
- No requests were sent to the band's original Apps Script backend.

See `PILOT.md` for the remaining acceptance checks. The deployed site is ready for an isolated sample-data pilot; these results do not yet establish that it is ready for real sales.
