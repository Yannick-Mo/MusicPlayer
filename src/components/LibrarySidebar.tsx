import { createSignal, onMount, onCleanup, type Component } from "solid-js";
import { libraryStore, setLibraryStore } from "../store/libraryStore";
import { getPlatform } from "../platform";

const SIDEBAR_WIDTH_KEY = "library_sidebar_width";

const LibrarySidebar: Component = () => {
  const [showModal, setShowModal] = createSignal(false);
  const [inputVal, setInputVal] = createSignal("");
  const [ctxMenu, setCtxMenu] = createSignal<{ x: number; y: number; catId: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = createSignal<string | null>(null);
  const [dragging, setDragging] = createSignal(false);
  const [width, setWidth] = createSignal(180);
  const savedWidth = typeof window !== "undefined" ? localStorage.getItem(SIDEBAR_WIDTH_KEY) : null;
  if (savedWidth) setWidth(Math.max(120, Math.min(400, parseInt(savedWidth) || 180)));
  const [scrollTop, setScrollTop] = createSignal(0);
  const [scrollH, setScrollH] = createSignal(0);
  const [clientH, setClientH] = createSignal(0);
  let scrollRef: HTMLDivElement | undefined;

  const thumbSize = () => {
    const ch = clientH(), sh = scrollH();
    if (sh <= ch) return 0;
    return Math.max(4, (ch / sh) * ch);
  };
  const thumbOffset = () => {
    const ch = clientH(), sh = scrollH(), st = scrollTop();
    if (sh <= ch) return 0;
    return (st / (sh - ch)) * (ch - thumbSize());
  };
  const updateScroll = () => {
    if (scrollRef) {
      setScrollTop(scrollRef.scrollTop);
      setScrollH(scrollRef.scrollHeight);
      setClientH(scrollRef.clientHeight);
    }
  };

  function startDrag(e: MouseEvent) {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startW = width();
    function move(ev: MouseEvent) {
      const newW = Math.max(120, Math.min(400, startW + ev.clientX - startX));
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

  async function confirmCreate() {
    const name = inputVal().trim();
    if (!name) return;
    const isTauri = "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        const platform = await getPlatform();
        const cat = await platform.createCategory(name, "🎶");
        setLibraryStore("categories", [...libraryStore.categories, { id: cat.id, name: cat.name, icon: cat.icon, type: "user", songIds: cat.song_ids }]);
      } catch (err) {
        console.error("创建歌单失败:", err);
      }
    } else {
      setLibraryStore("categories", [...libraryStore.categories, { id: "playlist-" + Date.now(), name, icon: "🎶", type: "user", songIds: [] }]);
    }
    setShowModal(false);
    setInputVal("");
  }

  function cancelCreate() {
    setShowModal(false);
    setInputVal("");
  }

  function closeCtxMenu() {
    setCtxMenu(null);
  }

  onMount(() => {
    document.addEventListener("click", closeCtxMenu);
    updateScroll();
  });
  onCleanup(() => {
    document.removeEventListener("click", closeCtxMenu);
  });

  return (
    <div class="flex-shrink-0 flex flex-col p-4 relative" style={{
      width: `${width()}px`,
      "border-right": "1px solid rgba(255,255,255,0.06)",
    }}>
      <div class="text-sm font-semibold mb-3.5 px-1 flex-shrink-0" style="color: rgba(255,255,255,0.8); letter-spacing: 0.5px;">
        📚 我的歌单
      </div>

      <div class="flex-1 min-h-0 relative" style="margin-right:-16px;">
        <div ref={scrollRef} class="absolute inset-0 overflow-y-auto pr-[17px]" style="scrollbar-width:none;-ms-overflow-style:none;" onScroll={updateScroll}>
          {libraryStore.categories.map((cat) => {
            const count = cat.id === "all" ? libraryStore.songs.length : cat.songIds.length;
            const isActive = libraryStore.activeCategoryId === cat.id;
            return (
              <div
                onClick={() => setLibraryStore("activeCategoryId", cat.id)}
                onContextMenu={(e) => {
                  if (cat.type === "user") {
                    e.preventDefault();
                    e.stopPropagation();
                    setCtxMenu({ x: e.clientX, y: e.clientY, catId: cat.id });
                  }
                }}
                class="flex items-center gap-[7px] px-3 py-2.5 rounded-md text-sm cursor-pointer mb-0.5 hover:bg-white hover:bg-opacity-5"
                style={{
                  background: isActive ? "rgba(var(--accent-rgb), 0.15)" : undefined,
                  color: isActive ? "#ffffff" : "rgba(255,255,255,0.7)",
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
                <span class="ml-auto text-xs" style="color: rgba(255,255,255,0.35);">{count}</span>
              </div>
            );
          })}
        </div>
        <div class="absolute right-0 top-0 w-px pointer-events-none" style={{ height: `${clientH()}px`, opacity: scrollH() > clientH() ? 0.6 : 0, transition: "opacity 0.15s" }}>
          <div class="w-px rounded-full" style={{ height: `${thumbSize()}px`, transform: `translateY(${thumbOffset()}px)`, background: "rgba(255,255,255,0.2)" }} />
        </div>
      </div>

      <div class="mt-auto pt-3 flex-shrink-0">
        <div
          onClick={() => setShowModal(true)}
          class="flex items-center justify-center gap-1 py-2.5 text-sm rounded-md cursor-pointer"
          style="color: rgba(255,255,255,0.75); border: 1px solid rgba(255,255,255,0.2);"
        >
          ＋ 新建歌单
        </div>
      </div>

      <style>{`.scm-item:hover{background:rgba(var(--accent-rgb,99,102,241),0.15)}`}</style>
      {ctxMenu() && (
        <div
          class="fixed z-50 rounded-lg py-1 px-1 min-w-[130px]"
          style={{
            left: `${ctxMenu()!.x}px`,
            top: `${ctxMenu()!.y}px`,
            background: "rgba(15,15,22,0.3)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            onClick={() => { setDeleteTarget(ctxMenu()!.catId); setCtxMenu(null); }}
            class="scm-item px-3 py-2 text-xs cursor-pointer rounded"
            style="color: rgba(255,255,255,0.6);"
          >🗑️ 删除歌单</div>
        </div>
      )}

      {deleteTarget() && (
        <div
          class="fixed inset-0 flex items-center justify-center z-50"
          style="background: rgba(0,0,0,0.5);"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div
            class="rounded-xl p-5 flex flex-col gap-3.5 min-w-[280px]"
            style="background: rgba(15,15,22,0.3); border: 1px solid rgba(255,255,255,0.08);"
          >
            <div class="text-xs font-semibold" style="color: rgba(255,255,255,0.85);">确认删除</div>
            <div class="text-[11px]" style="color: rgba(255,255,255,0.5);">确定要删除这个歌单吗？此操作不可撤销。</div>
            <div class="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                class="px-3 py-1.5 text-[11px] rounded-md"
                style="background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.55);"
              >取消</button>
              <button
                onClick={async () => {
                  const catId = deleteTarget()!;
                  const isTauri = "__TAURI_INTERNALS__" in window;
                  if (isTauri) {
                    try {
                      const platform = await getPlatform();
                      await platform.deleteCategory(catId);
                    } catch (err) {
                      console.error("删除歌单失败:", err);
                    }
                  }
                  setLibraryStore("categories", (cats) => cats.filter((c) => c.id !== catId));
                  if (libraryStore.activeCategoryId === catId) {
                    setLibraryStore("activeCategoryId", "all");
                  }
                  setDeleteTarget(null);
                }}
                class="px-3 py-1.5 text-[11px] rounded-md"
                style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white;"
              >删除</button>
            </div>
          </div>
        </div>
      )}

      {showModal() && (
        <div
          class="fixed inset-0 flex items-center justify-center z-50"
          style="background: rgba(0,0,0,0.5);"
          onClick={(e) => { if (e.target === e.currentTarget) cancelCreate(); }}
        >
          <div
            class="rounded-xl p-5 flex flex-col gap-3.5 min-w-[280px]"
            style="background: rgba(15,15,22,0.3); border: 1px solid rgba(255,255,255,0.08);"
          >
            <div class="text-xs font-semibold" style="color: rgba(255,255,255,0.85);">新建歌单</div>
            <input
              value={inputVal()}
              onInput={(e) => setInputVal(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmCreate(); }}
              placeholder="输入歌单名称..."
              class="w-full outline-none rounded-md px-3 py-2 text-xs"
              style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.7);"
              autofocus
            />
            <div class="flex justify-end gap-2">
              <button
                onClick={cancelCreate}
                class="px-3 py-1.5 text-[11px] rounded-md"
                style="background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.55);"
              >取消</button>
              <button
                onClick={confirmCreate}
                class="px-3 py-1.5 text-[11px] rounded-md"
                style="background: var(--accent-gradient); color: white;"
              >确认</button>
            </div>
          </div>
        </div>
      )}
      <div
        onMouseDown={startDrag}
        class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-40 transition-colors"
        style={{ background: "transparent", "--hover-bg": "rgba(var(--accent-rgb), 0.3)" } as any}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(var(--accent-rgb), 0.3)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      />
    </div>
  );
};

export default LibrarySidebar;
