# Set up your isolated Google pilot

## Account steps

Use your personal Google account. No access to the band's current script or data is required.

1. Sign into https://script.google.com/home/usersettings and enable the Google Apps Script API if using clasp.
2. Sign into your account when the clasp OAuth flow asks. Do not paste Google passwords, OAuth tokens, or the band passphrase into Git, chat, or deployment logs.
3. Create a **new standalone** Apps Script project named `Hottt Probs — pilot`. Do not clone or deploy over the band's existing script.

## Upload source

Google's clasp CLI is pinned as a development dependency and can upload the `apps-script` directory. Run `npm ci` on another computer to install it. A checked-in `.clasp.example.json` documents the mapping. The actual `.clasp.json` and OAuth credentials are ignored by Git. The Apps Script API toggle is needed for CLI project access.

For this pilot, keep credentials isolated from any other clasp projects:

```sh
npx clasp --auth .clasprc.json --user hp-pilot login
```

Use the same `--auth .clasprc.json --user hp-pilot` options for subsequent clasp commands. Use `npx clasp create-script --help` and `npx clasp create-deployment --help` for the installed version's options. Review newly generated manifests before uploading, keeping the checked-in permissions and web-app configuration.

Alternatively, use the web editor: create `Inventory.gs` from `apps-script/Inventory.js`, replace `Code.gs` with `apps-script/Code.gs`, and show the manifest in Project Settings to replace `appsscript.json` with the checked-in manifest. Do not paste frontend files into this project.

## Configure and initialize

1. In Project Settings > Script Properties, add `BAND_PASSPHRASE`: a long random passphrase, at least 16 characters. Enter it directly in Google. Script editors can access this credential; grant editor access only to maintainers.
2. In the editor select `setupPilot` and run it. Authorize the spreadsheet access requested by your own script. If a Google warning prevents authorization, stop and inspect the project/account rather than changing unrelated security settings.
3. `setupPilot` creates a new spreadsheet and saves its ID as `SHEET_ID` in Script Properties. It seeds the sample opening quantities from this repository. Running it again validates existing data without resetting it.
4. Find `Hottt Probs — pilot inventory` in your Drive. Do not share it publicly or modify its event rows.

## Deploy and connect

1. Deploy > New deployment > Web app.
2. Execute as **Me**; access **Anyone** (the anonymous option). The backend checks the app passphrase on every data request; Google sharing is not the app's login mechanism. If this option is unavailable, stop and inspect account policy.
3. Copy the versioned URL ending in `/exec`. The editor-only `/dev` URL is not the pilot endpoint.
4. Set `window.HP_CONFIG.endpoint` in `config.js` to this new URL. Set a clear pilot label.
5. Serve the frontend locally and run the real-browser acceptance checks in `PILOT.md`. The frontend uses text/plain POST requests, explicit JSON acknowledgments, and Google redirects. Do not use `no-cors` or JSONP to hide a failed browser integration test.
6. In your fork's Settings > Pages, select GitHub Actions as the source. Push the source and workflows, then manually run "Publish pilot to GitHub Pages" from Actions on the intended branch. This runs the tests and publishes only `.site-output`, never the repository root. Repeat the cross-origin checks at that exact Pages URL. A code push runs tests but does not automatically publish.
7. To update server code, upload it, create a new version, and update the existing deployment to that version to preserve its URL. Uploading source alone does not update a versioned deployment.

## Handoff to the band

Preferred: keep your pilot and create production under her account.

1. Have her create a standalone script and upload the identical tested source.
2. Create a new Sheet for production under her account. For a real-data handoff, pause edits, let all pending requests resolve, export a backup, and make a copy of the authoritative pilot Sheet (including the complete Events tab). Sample-only pilot data must not be mistaken for real inventory.
3. Set her `SHEET_ID` to the copied Sheet ID and set a new `BAND_PASSPHRASE`. Run `setupPilot` to validate the supplied log; it will not seed over it. Ensure her deploying account can access the Sheet.
4. Have her authorize and create her own web-app deployment. Google does not transfer ownership of existing versioned deployments with a script project.
5. Update the frontend configuration to her new endpoint and remove the sample-pilot label. Merge the frontend/backend source through a pull request to her repository. Her GitHub Pages URL can stay the same.
6. Verify inventory, a sale/void, export, and access from her phone. Keep an export of the final old state. Stop use of the old app at cutover; changes made against the old endpoint will not move to production automatically.
7. Retire obsolete deployments when she confirms the switch. Keep testing against a separate pilot Sheet and script. Never point the pilot and production script projects at the same writable Sheet.

Copying a complete Sheet preserves the event log and requires no custom import endpoint. The JSON export is an additional independent recovery format; an automated JSON import tool is not included yet.

## References

- https://developers.google.com/apps-script/guides/clasp
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/concepts/deployments
- https://developers.google.com/apps-script/reference/lock/lock-service
