# Chrome Web Store: Privacy practices tab (copy-paste answers)

SoupDraw collects and transmits nothing. Everything runs on-device with zero
runtime network. These justifications reflect exactly that.

Privacy policy URL: `https://draw.soupup.ai/privacy`

## Single purpose description
> SoupDraw lets you draw and annotate on your own live webcam feed using hand
> gestures, so your annotations appear in your outgoing video during any video
> call. It composites a local drawing canvas over your camera entirely on-device.

## Host permission justification  (`<all_urls>`)
> SoupDraw must work on whatever site you take a video call on: Google Meet, Zoom
> web, Microsoft Teams, Whereby, and many others. Its content script intercepts the
> page's own camera request (getUserMedia) and returns your camera composited with
> your drawings, so the augmented feed works inside the call app you already use.
> Because video-call sites are numerous and chosen by the user, a fixed host list
> is not workable and broad host access is required. The extension reads no page
> content and sends no data anywhere; it only augments the local camera stream on
> that page.

## Remote code: declare "NO, does not use remote code"
Remote code (per Chrome) means JS/Wasm NOT in the package: external `<script>`
tags, modules pointing to external files, or `eval()` of strings. SoupDraw has
none:
- No external `<script>`, CDN, or module references (audited; the only http URL in
  the package is a code comment inside MediaPipe's vendored glue).
- No `eval()` / `new Function()`. The CSP grants only `wasm-unsafe-eval`, not
  `unsafe-eval`, so string-eval would not even run.
- The single dynamic `import()` resolves to `chrome.runtime.getURL("") +
  "vendor/tasks-vision/vision_bundle.mjs"`, a PACKAGED file. The model and WASM load
  from that same bundled `vendor/tasks-vision/` folder.

So select **"No, I am not using remote code."** That clears the error (a
justification is only required when you answer Yes). `wasm-unsafe-eval` merely
compiles the BUNDLED `.wasm` on-device: packaged code, not remote.

## Storage justification
> The storage permission saves your preferences locally with chrome.storage.local:
> whether drawing is armed, pen colour and size, your gesture-to-action bindings,
> and your pinch-calibration values. This data never leaves your device and is
> never transmitted.

## Data collection checkboxes: check NOTHING
SoupDraw COLLECTS none of the listed categories (collection means the developer
receives / transmits / stores off-device; SoupDraw does none):
- Website content (video): camera frames are composited and DISCARDED every frame.
  They are never stored or transmitted. Accessing is not collecting. Unchecked.
- User activity: gestures drive drawing in real time; nothing logged or sent. Unchecked.
- Web history: runs on all sites but records no pages. Unchecked.
- PII / health / financial / auth / communications / location: never touched. Unchecked.
The only persisted data is settings and drawings in chrome.storage.local, on the
user's own device, never sent to the developer, so not "collected" data to disclose.

## Data usage certification (checkboxes)
Declare, and certify compliance:
- I do not sell or transfer user data to third parties (outside approved use cases).
- I do not use or transfer user data for purposes unrelated to the single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending.

There is no analytics, no account, no server. The "on-device, nothing leaves your
machine" claim is literally true: no runtime network calls exist.
