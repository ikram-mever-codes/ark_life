// src/pre-start.ts
const dummy = class {
  constructor() {
    return {};
  }
};
(global as any).DOMMatrix = dummy;
(global as any).ImageData = dummy;
(global as any).Path2D = dummy;
(global as any).CanvasRenderingContext2D = dummy;

// This fixes the "process.getBuiltinModule" error for Node 18
if (typeof (process as any).getBuiltinModule !== "function") {
  (process as any).getBuiltinModule = (name: string) => {
    return require(name);
  };
}
