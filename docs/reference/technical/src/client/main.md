# `src/client/main.tsx`

This module imports the browser styles and renders `App` into `#root` using React `StrictMode`. It depends on `index.html` providing that element. If it is absent, the module throws rather than silently leaving an unusable empty page. It handles no private data and has no network side effects.
