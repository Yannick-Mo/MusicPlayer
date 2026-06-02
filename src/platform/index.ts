import type { IPlatform } from "./interface";
import { browserPlatform } from "./browser";

function isTauri(): boolean {
  try {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  } catch {
    return false;
  }
}

let platform: IPlatform;

async function initPlatform(): Promise<IPlatform> {
  if (isTauri()) {
    const { tauriPlatform } = await import("./tauri");
    return tauriPlatform;
  }
  return browserPlatform;
}

const platformPromise = initPlatform();
export async function getPlatform(): Promise<IPlatform> {
  if (!platform) {
    platform = await platformPromise;
  }
  return platform;
}
