import type { IPlatform } from "./interface";
import { browserPlatform } from "./browser";
import { isTauri } from "../core/utils";

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
