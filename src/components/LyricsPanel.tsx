import { createResource, type Component } from "solid-js";
import type { SyncState } from "../core/lyricsSync";
import { getPlatform } from "../platform";
import { convertFileSrc } from "@tauri-apps/api/core";

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) || 255;
  const g = parseInt(c.substring(2, 4), 16) || 255;
  const b = parseInt(c.substring(4, 6), 16) || 255;
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

interface LyricsPanelProps {
  syncState: SyncState;
  title: string;
  artist: string;
  songId?: number;
  transparent?: boolean;
  fontSize?: number;
  showTranslation?: boolean;
  activeWordColor?: string;
  activeLineColor?: string;
  inactiveColor?: string;
  opacity?: number;
  bgColor?: string;
}

const LyricsPanel: Component<LyricsPanelProps> = (props) => {
  const [coverUrl] = createResource(() => props.songId, async (id) => {
    try {
      const platform = await getPlatform();
      const path = await platform.getCoverPath(id);
      return convertFileSrc(path);
    } catch { return undefined; }
  });

  const visibleLines = () => {
    const idx = props.syncState.currentLineIndex;
    const all = props.syncState.lines;
    if (!props.syncState.hasLyrics || idx < 0) return [];
    const start = Math.max(0, idx - 1);
    const end = Math.min(all.length, idx + 3);
    return all.slice(start, end).map((line, i) => ({
      line,
      isCurrent: start + i === idx,
    }));
  };

  return (
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      {!props.syncState.hasLyrics ? (
        <div
          class={`${props.transparent ? "" : "w-[65%] max-w-[560px] px-11 py-9 rounded-[18px]"} text-center`}
          style={props.transparent ? "" : `background: ${hexToRgba(props.bgColor ?? "#ffffff", (props.opacity ?? 50) / 100 * 0.6)}; border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 8px 48px rgba(0,0,0,0.3);`}
        >
          <h1 class="text-xl font-semibold" style={`color: rgba(255,255,255,0.9); ${props.transparent ? "text-shadow: 0 0 16px rgba(var(--accent-rgb), 0.6), 0 0 32px rgba(var(--accent-rgb), 0.3);" : ""}`}>{props.title}</h1>
          <p class="text-xs mt-1" style="color: rgba(255,255,255,0.35);">{props.artist}</p>
          <p class="text-xs mt-8" style="color: rgba(255,255,255,0.2);">暂无歌词</p>
        </div>
      ) : (
        <div
          class={`${props.transparent ? "" : "w-[65%] max-w-[560px] px-11 py-9 rounded-[18px]"} text-center`}
          style={props.transparent ? "" : `background: ${hexToRgba(props.bgColor ?? "#ffffff", (props.opacity ?? 50) / 100 * 0.6)}; border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 8px 48px rgba(0,0,0,0.3);`}
        >
          <div class="mb-5">
            <h1 class="text-xl font-semibold leading-tight" style={`color: rgba(255,255,255,0.9); ${props.transparent ? "text-shadow: 0 0 16px rgba(var(--accent-rgb), 0.6), 0 0 32px rgba(var(--accent-rgb), 0.3);" : ""}`}>{props.title}</h1>
            <p class="text-xs mt-1" style="color: rgba(255,255,255,0.35);">{props.artist}</p>
          </div>

          <div
            class="w-[130px] h-[130px] rounded-full mx-auto mb-5 flex items-center justify-center overflow-hidden"
            style={coverUrl() ? undefined : { background: "var(--accent-gradient)", border: "3px solid rgba(255,255,255,0.08)", "box-shadow": "0 8px 40px rgba(var(--accent-rgb), 0.3)" }}
          >
            {coverUrl() ? (
              <img src={coverUrl()!} class="w-full h-full object-cover" alt="" />
            ) : (
              <span style="color: rgba(255,255,255,0.3); font-size: 36px;">♪</span>
            )}
          </div>

          <div class="leading-[2.2] max-h-[200px] overflow-hidden" style={{ "font-size": `${props.fontSize ?? 15}px` }}>
            {visibleLines().map(({ line, isCurrent }) => (
              <div style={{ color: isCurrent ? (props.activeLineColor ?? "#d4d4d4") : (props.inactiveColor ?? "#555555") }}>
                {isCurrent && line.words.length > 0 ? (
                  <span style="letter-spacing: 1px;">
                    {line.words.map((w, i) => {
                      const awc = props.activeWordColor ?? "#a78bfa";
                      const alc = props.activeLineColor ?? "#d4d4d4";
                      const wordColor = i <= props.syncState.currentWordIndex ? awc : alc;
                      const glow = i <= props.syncState.currentWordIndex ? `text-shadow: 0 0 12px ${awc}80;` : "";
                      return (
                        <span style={`color: ${wordColor}; ${glow}`}>
                          {w.word}{" "}
                        </span>
                      );
                    })}
                  </span>
                ) : (
                  <span>{line.text || " "}</span>
                )}
                {line.translation && isCurrent && props.showTranslation !== false && (
                  <div class="italic mt-1" style={{ color: props.inactiveColor ?? "#555555", "font-size": `${(props.fontSize ?? 15) - 3}px` }}>
                    {line.translation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LyricsPanel;
