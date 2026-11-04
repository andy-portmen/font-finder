// ES module wrapper around the vendored brotli-dec-wasm decoder;
// classic scripts (resolve.js) pick it up through self.brotliReady / self.brotliDec
import brotliInit, * as brotli from './pkg/brotli_dec_wasm.js';

// the default export is an async init; without arguments it loads the
// sibling brotli_dec_wasm_bg.wasm; the JS API (DecompressStream, ...) lives
// in the module namespace, not in the resolved wasm exports
self.brotliReady = brotliInit().then(() => {
  self.brotliDec = brotli;
});
