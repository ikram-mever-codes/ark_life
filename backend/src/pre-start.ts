// src/pre-start.ts
// pdfjs-dist expects browser canvas globals. Use the real implementations
// from @napi-rs/canvas (needed to render PDF pages for OCR); fall back to
// inert dummies if the native module is unavailable on this platform.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const canvas = require("@napi-rs/canvas");
  (global as any).DOMMatrix ??= canvas.DOMMatrix;
  (global as any).ImageData ??= canvas.ImageData;
  (global as any).Path2D ??= canvas.Path2D;
} catch {
  const dummy = class {
    constructor() {
      return {};
    }
  };
  (global as any).DOMMatrix ??= dummy;
  (global as any).ImageData ??= dummy;
  (global as any).Path2D ??= dummy;
  (global as any).CanvasRenderingContext2D ??= dummy;
}

// This fixes the "process.getBuiltinModule" error for Node 18
if (typeof (process as any).getBuiltinModule !== "function") {
  (process as any).getBuiltinModule = (name: string) => {
    return require(name);
  };
}
