# The King’s AI interface

The interface uses a dark shared workspace shell, cyan holographic orb, conversation panel, voice settings, and activity panel. Home and Chat change layout without unmounting the conversation. Tasks, Calendar, Files, and Memory are visible disabled navigation entries with no extra labels.

## Branding and navigation

Change APP_BRAND in lib/app-config.ts to rename the app or change its mark and tagline. WORKSPACE_NAV holds the module labels, icons, enabled states, and optional routes. When a module is implemented, enable its entry and supply its href. Home/Chat currently switch local views; give them href values if moving the shell into a shared route layout.

AppShell accepts children, activeView (any ModuleId), optional onNavigate, title, and description. It contains no conversation state. Future modules can use a wide main area and a context rail, rather than inheriting the chat card’s width. Use workspace-content-grid for a main + context layout. Keep the shell in one shared layout when adding routes; do not nest duplicate shells. Keep a conversation provider in that layout if chat state must survive route changes.

## Shared styling

Update :root tokens in app/globals.css to change the project-wide theme. Tokens cover primary, secondary, accent, surfaces, text, borders, success, danger, warning, spacing, radii, shadows, focus, and motion.

| Use | Classes |
| --- | --- |
| Surfaces | panel, panel-header, panel-title, panel-icon |
| Actions | btn btn-primary, btn-secondary, btn-ghost, btn-danger, icon-button |
| Inputs | field |
| Typography | eyebrow, text-primary, text-secondary, text-accent, text-muted, text-success, text-danger |
| Layout | stack, cluster, workspace-content-grid |
| Status | badge badge-neutral, badge-accent, status-dot, alert alert-error |
| Controls | switch-control, segmented-control |
| Accessibility | sr-only, skip-link |

Use btn with its variant classes. Avoid copying raw colors or building unrelated button styles in new modules. Module-specific classes describe layout; shared tokens and primitives keep visual choices consistent.

## Responsive and accessible behavior

The desktop sidebar becomes an icon rail on narrower screens and a horizontal navigation bar on phones. Dashboard columns stack for smaller widths. Focus indicators, button labels, switch semantics, reduced-motion rules, and a skip link are included. The holographic sphere is native SVG/CSS, so there are no image/font dependencies. Its motion represents conversation state; the decorative waveform does not measure live audio amplitude.

## Functional boundary

Chat, microphone, transcription review, VAD, streamed sentence playback, manual speaker buttons, and cancellation use the existing controllers. The activity panel reflects those states rather than fabricated tasks or backend connection status. No backend changes or new application dependencies are required.

## Verify locally

Run npm run build, then npm run dev with Ollama and the Python service running. Check Home/Chat, a typed message, two consecutive voice questions, Review countdown cancellation, Immediate mode, VAD off/manual stop, auto voice off, manual playback/stop, and phone widths around 390px. This package has not received a live browser visual check in the delivery environment.
