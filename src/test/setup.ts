import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Clean up DOM after each test
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Polyfill URL object URL methods for JSDOM
if (typeof globalThis !== "undefined") {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:http://localhost:8080/mock-blob-uuid");
  globalThis.URL.revokeObjectURL = vi.fn();
}

// Polyfill window browser APIs
if (typeof window !== "undefined") {
  // Polyfill ResizeObserver for Radix UI / Responsive components
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // Polyfill matchMedia
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  // Mock HTMLCanvasElement 2D context
  const mockContext = {
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    strokeStyle: "#000",
    lineWidth: 1,
    fillStyle: "#000",
    font: "12px sans-serif",
    textBaseline: "middle",
  };

  HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
    if (contextId === "2d") return mockContext as unknown as CanvasRenderingContext2D;
    return null;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,mockPngDataUrl");
}
