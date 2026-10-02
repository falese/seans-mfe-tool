/**
 * Minimal ambient DOM declarations for the page serializer.
 *
 * The root tsconfig compiles with `lib: ["ES2020"]` — no DOM lib — but
 * `page-serializer.ts` is written as a real function so Playwright can ship it
 * to the browser via `fn.toString()`. These declarations cover exactly the DOM
 * surface the serializer touches; they are compile-time only, the real browser
 * globals exist at evaluation time.
 */

interface DomRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
}

interface DomStyleLike {
  getPropertyValue(name: string): string;
}

interface DomNodeLike {
  nodeType: number;
  nodeValue: string | null;
  childNodes: ArrayLike<DomNodeLike>;
}

interface DomElementLike extends DomNodeLike {
  tagName: string;
  id: string;
  className: string | { baseVal: string };
  getBoundingClientRect(): DomRectLike;
  getAttribute(name: string): string | null;
  currentSrc?: string;
  src?: string;
}

interface DomRangeLike {
  selectNodeContents(node: DomNodeLike): void;
  getBoundingClientRect(): DomRectLike;
}

declare const document: {
  documentElement: DomElementLike;
  body: DomElementLike;
  title: string;
  createRange(): DomRangeLike;
};

declare const window: {
  innerWidth: number;
  innerHeight: number;
  scrollX: number;
  scrollY: number;
};

declare function getComputedStyle(el: DomElementLike): DomStyleLike;
