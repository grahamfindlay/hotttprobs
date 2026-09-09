# Pilot status — 2026-09-09

- Google owner: Graham's personal account.
- Script project: `1x9O7uoMQYcFj1rvijXcTAmxTH3rP32HXuof7FX5_VVChfGRASqWS5vEY`.
- Backend version: 1.
- Deployment: `AKfycby8JTgET0hRWaBfR935pdS3vCUEx3Rxlcomd5vmKg8Prb4dV9w5Yjbks14eSyW3C7aHZw`.
- Owner reports `setupPilot` completed and the passphrase is configured.
- All 25 automated tests pass.
- Real endpoint GET returns an authentication error without inventory.
- The in-app browser at `http://127.0.0.1:4173` can read the Google backend's JSON response to an incorrect passphrase. Google redirects and cross-origin POST work for this check.
- Real-browser testing caught an illegal invocation of native `fetch`. The client now invokes the injected fetcher as a function; a regression test covers the receiver.
- Authenticated loading works in the live browser. A sale reduced stock and appeared in the active sales log; voiding it removed the sale and restored stock. A stock adjustment changed inventory without adding a sale, and its reversing adjustment restored the starting count.
- Exporting successfully completed the authenticated server request, but the original automatic-download UI did not produce a browser-confirmed download. The UI now exposes a persistent `Download backup (.json)` link with a visible ready state, covered by an automated test; live download verification remains pending.
- The owner explicitly approved a live closeout test. It remains pending because the unlocked local preview tab closed before the test completed.
- Concurrent real browsers, actual phone testing, and the GitHub Pages deployment are pending.
- No requests were sent to the band's original Apps Script backend.

See `PILOT.md` for the remaining acceptance checks. These results do not yet establish that the pilot is ready for real sales.
