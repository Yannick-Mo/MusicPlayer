import { createSignal, For, type Component } from "solid-js";

export interface ToastMessage {
  text: string;
  id: number;
}

let toastId = 0;
const [toasts, setToasts] = createSignal<ToastMessage[]>([]);

export function showToast(text: string, duration = 2000) {
  const id = ++toastId;
  setToasts((prev) => [...prev, { text, id }]);
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, duration);
}

const Toast: Component = () => {
  return (
    <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      <For each={toasts()}>{(t) => (
        <div
          class="px-4 py-2 rounded-lg text-xs whitespace-nowrap animate-fade-in"
          style={{
            background: "rgba(10,10,15,0.85)",
            "backdrop-filter": "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          {t.text}
        </div>
      )}</For>
    </div>
  );
};

export default Toast;
