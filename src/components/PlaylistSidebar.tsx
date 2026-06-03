import { createSignal, createResource, type Component } from "solid-js";
import { playerStore, setPlayerStore, savePlayerState } from "../store/playerStore";
import { executeCommand } from "../core/commandBus";
import { libraryStore } from "../store/libraryStore";
import { getPlatform } from "../platform";
import { convertFileSrc } from "@tauri-apps/api/core";

interface PlaylistSidebarProps {
  open: boolean;
  onClose: () => void;
}

const SIDEBAR_WIDTH_KEY = "playlist_sidebar_width";

const QueueCover: Component<{ id: number; playing: boolean }> = (p) => {
  const [url] = createResource(() => p.id, async (id) => {
    try {
      const platform = await getPlatform();
      const path = await platform.getCoverPath(id);
      return convertFileSrc(path);
    } catch { return undefined; }
  });
  return (
    <div class="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mr-3 overflow-hidden"
      style={{
        background: url() ? undefined : (p.playing ? "var(--accent-gradient)" : "rgba(255,255,255,0.06)"),
      }}
    >
      {url() ? (
        <img src={url()!} class="w-full h-full object-cover" alt="" />
      ) : (
        <span class="text-[10px]" style={{ color: p.playing ? "white" : "rgba(255,255,255,0.65)" }}>
          {p.playing ? "▶" : "♫"}
        </span>
      )}
    </div>
  );
};

const PlaylistSidebar: Component<PlaylistSidebarProps> = (props) => {
  const [search, setSearch] = createSignal("");
  const [dragging, setDragging] = createSignal(false);
  const [dragIndex, setDragIndex] = createSignal<number | null>(null);
  const [dropIndex, setDropIndex] = createSignal<number | null>(null);
  const [width, setWidth] = createSignal(320);
  const savedWidth = typeof window !== "undefined" ? localStorage.getItem(SIDEBAR_WIDTH_KEY) : null;
  if (savedWidth) setWidth(Math.max(200, Math.min(600, parseInt(savedWidth) || 320)));
  const [qScrollTop, setQScrollTop] = createSignal(0);
  const [qScrollH, setQScrollH] = createSignal(0);
  const [qClientH, setQClientH] = createSignal(0);
  let qScrollRef: HTMLDivElement | undefined;
  const qThumbSize = () => { const ch = qClientH(), sh = qScrollH(); return sh <= ch ? 0 : Math.max(4, (ch / sh) * ch); };
  const qThumbOff = () => { const ch = qClientH(), sh = qScrollH(), st = qScrollTop(); return sh <= ch ? 0 : (st / (sh - ch)) * (ch - qThumbSize()); };
  const qUpdateScroll = () => { if (qScrollRef) { setQScrollTop(qScrollRef.scrollTop); setQScrollH(qScrollRef.scrollHeight); setQClientH(qScrollRef.clientHeight); } };

  function startDrag(e: MouseEvent) {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startW = width();
    function move(ev: MouseEvent) {
      const newW = Math.max(200, Math.min(600, startW + ev.clientX - startX));
      setWidth(newW);
    }
    function end() {
      setDragging(false);
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width()));
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end, { once: true });
  }

  const filteredSongs = () =>
    playerStore.queue
      .map((s, idx) => ({ song: s, index: idx }))
      .filter(
        (item) =>
          item.song.title.toLowerCase().includes(search().toLowerCase()) ||
          item.song.artist.toLowerCase().includes(search().toLowerCase())
      );

  const handlePlay = (index: number) => {
    executeCommand("playAt", index);
  };

  const getDuration = (id: number, fallback?: string): string | undefined => {
    if (fallback) return fallback;
    const libSong = libraryStore.songs.find((s) => s.id === id);
    return libSong?.duration;
  };

  const totalDuration = () => {
    let total = 0;
    for (const s of playerStore.queue) {
      const dur = getDuration(s.id, s.duration);
      if (dur) {
        const parts = dur.split(":");
        total += parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
    }
    const m = Math.floor(total / 60);
    const sec = total % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <div
        class="h-full flex-shrink-0 relative z-30"
        style={{
          width: props.open ? `${width()}px` : "0px",
          transition: dragging() ? "none" : "width 0.3s",
          overflow: "hidden",
        }}
      >
        <div
          class="h-full flex flex-col"
          style={{
            width: `${width()}px`,
            background: "rgba(10,10,15,0)",
            "border-right": "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div class="p-4 border-b" style="border-color: rgba(255,255,255,0.06);">
            <div class="flex items-center justify-between mb-2.5">
              <div>
                <span class="text-sm font-semibold" style="color: rgba(255,255,255,0.9);">播放队列</span>
                <span class="text-[11px] ml-2" style="color: rgba(255,255,255,0.65);">{playerStore.queue.length} 首</span>
              </div>
              <button onClick={props.onClose} class="text-xs" style="color: rgba(255,255,255,0.65);">✕</button>
            </div>
            <div
              class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs"
              style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.05);"
            >
              <span style="color: rgba(255,255,255,0.65);">🔍</span>
              <input
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
                placeholder="搜索歌曲..."
                class="bg-transparent outline-none text-xs w-full"
                style="color: rgba(255,255,255,0.65);"
              />
            </div>
          </div>

                    <style>{`.queue-scroll{overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.queue-scroll::-webkit-scrollbar{width:0}`}</style>
          <div class="flex-1 relative">
            <div ref={qScrollRef} class="absolute inset-0 queue-scroll" onScroll={qUpdateScroll}>
              <div class="py-1">
                {filteredSongs().map(({ song, index }) => {
                  const playing = index === playerStore.queueIndex;
                  const isDragTarget = dropIndex() === index;
                  return (
                    <div
                      draggable
                      onClick={() => handlePlay(index)}
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(e) => { e.preventDefault(); setDropIndex(index); }}
                      onDragLeave={() => setDropIndex(null)}
                      onDrop={() => {
                        const from = dragIndex();
                        if (from === null || from === index) return;
                        const q = [...playerStore.queue];
                        const [moved] = q.splice(from, 1);
                        const to = from < index ? index - 1 : index;
                        q.splice(to, 0, moved);
                        setPlayerStore("queue", q);
                        setPlayerStore("queueIndex", playerStore.queueIndex === from ? to : playerStore.queueIndex > from && playerStore.queueIndex <= to ? playerStore.queueIndex - 1 : playerStore.queueIndex < from && playerStore.queueIndex >= to ? playerStore.queueIndex + 1 : playerStore.queueIndex);
                        savePlayerState();
                        setDragIndex(null);
                        setDropIndex(null);
                      }}
                      onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                      class="flex items-center px-4 py-2.5 cursor-pointer transition-colors group hover:bg-white hover:bg-opacity-5"
                      style={{
                        background: playing ? "rgba(var(--accent-rgb), 0.1)" : undefined,
                        "border-left": playing ? "3px solid var(--accent-light)" : "3px solid transparent",
                        "border-top": isDragTarget && dragIndex() !== index ? "2px solid var(--accent-light)" : "2px solid transparent",
                      }}
                    >
                      <QueueCover id={song.id} playing={playing} />
                      <div class="flex-1 min-w-0">
                        <div
                          class="text-xs truncate"
                          style={{ color: playing ? "#ffffff" : "rgba(255,255,255,0.85)" }}
                        >
                          {song.title}
                        </div>
                        <div class="text-[11px] truncate" style="color: rgba(255,255,255,0.65);">{song.artist}</div>
                      </div>
                      <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {song.hasLyrics && <span class="text-[10px]" style="color: rgba(52,211,153,0.4);">🎤</span>}
                        {(getDuration(song.id, song.duration)) && (
                          <span class="text-[11px] font-mono" style="color: rgba(255,255,255,0.65);">{getDuration(song.id, song.duration)}</span>
                        )}
                        {playing && (
                          <div class="flex items-end gap-[2px] h-[16px]">
                            <div class="w-[3px] rounded-[1.5px] h-[16px] bar-animate bar-d0" style={{ background: "var(--accent-gradient)", "transform-origin": "bottom" }} />
                            <div class="w-[3px] rounded-[1.5px] h-[16px] bar-animate bar-d1" style={{ background: "var(--accent-gradient)", "transform-origin": "bottom" }} />
                            <div class="w-[3px] rounded-[1.5px] h-[16px] bar-animate bar-d2" style={{ background: "var(--accent-gradient)", "transform-origin": "bottom" }} />
                            <div class="w-[3px] rounded-[1.5px] h-[16px] bar-animate bar-d3" style={{ background: "var(--accent-gradient)", "transform-origin": "bottom" }} />
                          </div>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); executeCommand("removeFromQueue", index); }}
                          class="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
                          style="color: rgba(255,255,255,0.65);"
                        >✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div class="absolute right-0 top-0 w-[2px] pointer-events-none" style={{ height: `${qClientH()}px`, opacity: qScrollH() > qClientH() ? 0.4 : 0 }}>
              <div class="w-[2px] rounded-full" style={{ height: `${qThumbSize()}px`, transform: `translateY(${qThumbOff()}px)`, background: "rgba(255,255,255,0.15)" }} />
            </div>
          </div>

          <div class="px-4 py-2.5 flex justify-between text-[11px] border-t" style="color: rgba(255,255,255,0.65); border-color: rgba(255,255,255,0.06);">
            <span
              onClick={() => executeCommand("clearQueue")}
              class="cursor-pointer"
            >🗑️ 清空队列</span>
            <span>总计 {totalDuration()}</span>
          </div>
        </div>
        {props.open && (
          <div
            onMouseDown={startDrag}
            class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-40 hover:bg-indigo-500 hover:bg-opacity-30 transition-colors"
            style="background: transparent;"
          />
        )}
      </div>
    </>
  );
};

export default PlaylistSidebar;
