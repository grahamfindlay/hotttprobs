# Real-browser pilot acceptance checks

Use only the new pilot deployment and sample inventory. Node tests must pass first. Record the tested Git commit, Apps Script version, frontend URL, date, browsers, devices, and outcomes here or in a separate pilot report. None of these live checks is marked complete by the automated suite.

- [x] Fresh browser: locked screen shows no guessed inventory. Correct passphrase loads the Sheet's actual counts; an incorrect one returns no data.
- [x] Inspect network: only the new configured endpoint is contacted. POST responses are readable JSON after Google redirects. No passphrase appears in a URL.
- [ ] Phone usability: select a style and size, record a sale, void it, draft several stock changes, save them together, switch tabs, copy recap, and export. Verify export and clipboard behavior on iPhone/Safari and Android/Chrome when available.
- [ ] Two devices: starting with at least two items, each sells one. Both sales remain; refresh shows a decrease of two.
- [ ] Last item: both attempt to sell the last one. Only one succeeds; the other reports out of stock and refreshes.
- [ ] Stock draft concurrency: leave a stock draft open, record a sale for the same item on another device, then save the draft. The sale and the relative stock change must both remain.
- [ ] Lost response/slow connection: record one sale, interrupt the response, reconnect and retry. Exactly one sale appears in the Sheet. While a request is pending, further edits are disabled.
- [ ] Reload with an uncertain request: unlock and retry; it is resolved exactly once. Do not clear localStorage.
- [ ] Offline: already-open app disables new edits. A failed refresh does not display a successful save status. Reconnect refreshes normally.
- [ ] Close a gig on one device while another still shows it: an old-gig action is rejected with a visible message; history remains in export.
- [ ] Export: save JSON, reconstruct with `Inventory.replay(export.events)`, compare stock and active sales to the app. Verify the copied Sheet independently in a second isolated deployment as a handoff rehearsal.
- [x] Log out and reload: inventory hides and passphrase must be entered again. A frontend deployment never resets the Sheet.
- [ ] Latency: time reads and saves on venue-like connectivity. Expand the sample log and repeat before adopting the full-log replay approach for extended use.

If the browser cannot read Apps Script responses, keep the pilot blocked until that is resolved. Serving the frontend through Apps Script HTML Service is a possible fallback, but is not implemented here. Never treat an opaque response as confirmation.
