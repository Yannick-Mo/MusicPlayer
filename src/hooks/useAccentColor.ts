import { createEffect } from "solid-js";
import { playerStore } from "../store/playerStore";

export function useAccentColor() {
  createEffect(() => {
    const c = playerStore.accentColor;
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const lr = Math.round(r + (255 - r) * 0.35);
    const lg = Math.round(g + (255 - g) * 0.35);
    const lb = Math.round(b + (255 - b) * 0.35);
    const light = `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
    const dr = Math.round(r * 0.6);
    const dg = Math.round(g * 0.6);
    const db = Math.round(b * 0.6);
    const dark = `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;

    let styleEl = document.getElementById("accent-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "accent-style";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      :root {
        --accent: ${c};
        --accent-rgb: ${r}, ${g}, ${b};
        --accent-light: ${light};
        --accent-dark: ${dark};
        --accent-gradient: linear-gradient(135deg, ${c}, ${light});
        accent-color: ${c};
      }
    `;
  });
}
