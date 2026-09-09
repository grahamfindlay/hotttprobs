# Pilot status — 2026-09-09

- Google owner: Graham's personal account.
- Script project: `1x9O7uoMQYcFj1rvijXcTAmxTH3rP32HXuof7FX5_VVChfGRASqWS5vEY`.
- Backend version: 1.
- Deployment: `AKfycby8JTgET0hRWaBfR935pdS3vCUEx3Rxlcomd5vmKg8Prb4dV9w5Yjbks14eSyW3C7aHZw`.
- Owner reports `setupPilot` completed and the passphrase is configured.
- All 24 automated tests pass.
- Real endpoint GET returns an authentication error without inventory.
- The in-app browser at `http://127.0.0.1:4173` can read the Google backend's JSON response to an incorrect passphrase. Google redirects and cross-origin POST work for this check.
- Real-browser testing caught an illegal invocation of native `fetch`. The client now invokes the injected fetcher as a function; a regression test covers the receiver.
- Authenticated read/write, concurrent browsers, actual phone testing, and GitHub Pages deployment are pending. The preview is waiting for the owner to unlock it directly.
- No requests were sent to the band's original Apps Script backend.

See `PILOT.md` for the remaining acceptance checks. These results do not yet establish that the pilot is ready for real sales.
