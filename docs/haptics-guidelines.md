# Haptics Guidelines

This project uses semantic haptic events from `src/lib/haptics` and the `web-haptics` package so product behavior stays consistent across native and web.

## Runtime strategy

- **Web-first default**: the web adapter uses `web-haptics` presets for semantic events.
- **Native path is feature-flagged**: native haptics only run when `VITE_ENABLE_NATIVE_HAPTICS` is set to `"true"`.
- **Unsupported platforms**: if neither web nor native adapter is available, haptics safely no-op.
- **Optional debug fallback**: set `VITE_WEB_HAPTICS_DEBUG="true"` to enable `web-haptics` debug audio feedback on unsupported browsers during testing.

**Browser support limitations**:
- Web vibration is not supported in Safari (iOS/macOS).
- Chrome supports vibration only on Android devices.
- On unsupported browsers, haptics fall back to the native adapter (if enabled) or no-op.

## Event mapping policy

- **Tap / SelectionChanged**
  - Use for lightweight interactions: navigation taps, toggles, tray/item selection.
  - Keep these subtle and short.
- **Success**
  - Use when a mutation completes successfully (save, approve, create, delete completion confirmation).
- **Warning / Error**
  - Use for failed destructive actions, blocked actions, and error outcomes.
  - Prefer `warning` for risky/destructive confirmation taps and `error` for failed operations.

## Throttling defaults

The haptics service applies a built-in rate limiter so repeated state updates from a single interaction produce at most one haptic.

- **Interaction class** (`tap`, `selectionChanged`)
  - Minimum interval: **160ms** between interaction-class events.
- **Confirmation class** (`success`, `warning`, `error`)
  - Minimum interval: **80ms** between confirmation-class events.
- **Per-event dedupe window**
  - Suppresses repeated invocations of the same semantic event inside **220ms**.

These defaults are intentionally conservative for high-frequency UI taps while keeping success/error confirmations responsive.

## Usage principles

1. **Use semantic methods only** (`haptics.tap()`, `haptics.success()`, etc.) — avoid raw vibration patterns in feature code.
2. **Do not trigger from render-only effects**. Haptics should fire from explicit user actions (click/press/confirm) or mutation callbacks.
3. **Button defaults**. Shared `Button` components trigger `tap` by default; set `haptic="none"` on buttons that already fire a semantic haptic manually to avoid double feedback.
4. **Respect accessibility preferences**. The haptics service checks `prefers-reduced-motion` and disables haptics when users request reduced motion. Keep a user-facing setting that allows disabling haptics entirely.
5. **Pair haptics with toast semantics** where possible to keep tactile and visual feedback aligned.

## Recommended pairing with toasts

- Success toast → `haptics.success()`
- Warning/destructive toast or confirm action → `haptics.warning()`
- Error toast → `haptics.error()`
