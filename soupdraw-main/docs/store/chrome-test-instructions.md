# Chrome Web Store: Test instructions (for reviewers)

## Field text (473 chars, fits the 500 limit)

```
No account or login needed; everything runs on-device. Test without a call:
1) Pin and click the toolbar icon, then "Practice gestures & calibrate".
2) Click "Playground: just draw" and allow the camera (a bundled hand model loads once).
3) Pinch thumb+index and move to draw. Thumb-out fist = erase, victory sign = move, fist = pan, double fist-clench = clear.
"Learn the gestures" gives a guided tutorial. Needs a webcam and decent lighting. No network calls at runtime.
```

## Longer notes (if a bigger field is available elsewhere)

The Practice window exercises the whole extension (camera interception, on-device
model, gesture drawing) without joining a call. No account, login, or payment.

In-call use (optional): turn on "Augment my camera" in the popup, open any camera
site (a getUserMedia test page or Google Meet), press Alt+Shift+D (Cmd+Shift+D on
Mac) to arm, then pinch to draw. Your drawings appear in the outgoing feed.

Permissions: storage (local settings only) plus host access, needed to intercept
the page's own camera request and return the augmented feed. No page content is
read; nothing is sent anywhere. No remote code: the WASM model is bundled and
loaded from chrome-extension:// URLs only.
