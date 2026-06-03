import { type Component } from "solid-js";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: Component<PaginationProps> = (p) => {
  return (
    <div class="flex justify-center items-center gap-1.5 pt-3 mt-auto border-t" style="border-color: rgba(255,255,255,0.04);">
      <button onClick={() => p.onPageChange(Math.max(1, p.page - 1))} disabled={p.page <= 1} class="text-xs" style="color: rgba(255,255,255,0.65);">‹</button>
      {Array.from({ length: p.totalPages }, (_, i) => i + 1).map((pg) => (
        <button onClick={() => p.onPageChange(pg)} class="text-xs px-[9px] py-[3px] rounded" style={{
          background: pg === p.page ? "rgba(var(--accent-rgb), 0.12)" : "transparent",
          color: pg === p.page ? "var(--accent-light)" : "rgba(255,255,255,0.65)",
        }}>{pg}</button>
      ))}
      <button onClick={() => p.onPageChange(Math.min(p.totalPages, p.page + 1))} disabled={p.page >= p.totalPages} class="text-xs" style="color: rgba(255,255,255,0.65);">›</button>
    </div>
  );
};

export { Pagination };
export default Pagination;
