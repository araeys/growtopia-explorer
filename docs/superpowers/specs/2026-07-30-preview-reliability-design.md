# Preview Reliability Design

## Goal

Every item with a valid texture must render its real sprite instead of a letter
placeholder. Raw tilesheet and sequence previews must remain responsive while
the 1,968-image catalog is browsed.

## Root causes

Item cards share cached `Image` objects. Only the first canvas registers an
`onload` callback; canvases that see the same image while it is still loading
draw a placeholder and are never repainted. The local server uses the
single-threaded `socketserver.TCPServer`, which can stall when the browser opens
many image connections. Sheet modal controls also lack dedicated CSS, and the
navigation count is hard-coded to 852.

## Browser image loading

A single loader function owns each texture URL and returns one Promise. Every
canvas awaits the Promise independently, so all consumers repaint when the
shared image becomes ready. Loading state is an empty checkerboard frame, never
a letter. A genuinely missing or invalid sprite uses a neutral no-sprite image
rendered on canvas.

## Server and sheet UI

`server.py` uses a threaded reusable HTTP server bound to localhost. Sheet mode
tabs, viewports, sequence canvas, zoom controls, and footer receive explicit
styles. Catalog counts in navigation and headings are updated from loaded JSON,
not hard-coded HTML values.

## Verification

Regression tests assert shared-image consumers subscribe to a single Promise,
the server class is threaded and localhost-bound, and static counts have runtime
targets. Browser verification covers item cards, the 1,968-sheet gallery, full
sheet preview, and sequence preview with zero failed image elements or console
errors.

