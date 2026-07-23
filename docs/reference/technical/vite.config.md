# `vite.config.ts`

## Default configuration

**Signature:** `defineConfig(({ mode }) => UserConfig)`

The default Vite configuration loads React for every mode and the Cloudflare plugin outside `test` mode. This isolation is intentional: Task 1's direct Vitest contract is a Node unit test, while Task 2 adds the Cloudflare workerd pool. Production builds therefore retain both required plugins and emit the Worker plus browser assets.
