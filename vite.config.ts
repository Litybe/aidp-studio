import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, constants as zlib, gzipSync } from 'node:zlib'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

const DAEMON = 'http://127.0.0.1:3001'
const COMPRESSIBLE = /\.(js|css|html|svg|json|txt|webmanifest)$/
const MIN_COMPRESS_BYTES = 1024

function* filesOf(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* filesOf(path)
    else yield path
  }
}

/** Writes `.br` and `.gz` next to each text asset; the daemon sends them as is (no on-the-fly compression). */
function precompress(): Plugin {
  let outDir = 'dist'
  return {
    name: 'aidp-precompress',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      for (const path of filesOf(outDir)) {
        if (!COMPRESSIBLE.test(path)) continue
        const source = readFileSync(path)
        if (source.length < MIN_COMPRESS_BYTES) continue
        const brotli = brotliCompressSync(source, {
          params: { [zlib.BROTLI_PARAM_QUALITY]: zlib.BROTLI_MAX_QUALITY },
        })
        const gzip = gzipSync(source, { level: 9 })
        if (brotli.length < source.length) writeFileSync(`${path}.br`, brotli)
        if (gzip.length < source.length) writeFileSync(`${path}.gz`, gzip)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), precompress()],
  build: {
    target: 'es2022',
    sourcemap: false,
    modulePreload: { polyfill: false },
    reportCompressedSize: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: DAEMON, changeOrigin: false, ws: false },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Agent worktrees hold full copies of the repo: never collect their tests.
    exclude: [...configDefaults.exclude, '.claude/**'],
    css: false,
    restoreMocks: true,
  },
})
