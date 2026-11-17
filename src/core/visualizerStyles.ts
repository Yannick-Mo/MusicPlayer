export type Visualizer3DStyle = "galaxy" | "cosmos" | "voyage" | "ribbons" | "asteroids" | "nebula";

export interface Visualizer3DStyleDef {
  id: Visualizer3DStyle;
  name: string;
  description: string;
  swatch: [string, string, string];
}

export const VISUALIZER_3D_STYLES: Visualizer3DStyleDef[] = [
  {
    id: "galaxy",
    name: "银河漩涡",
    description: "十万粒子旋臂星系，低音驱动星云呼吸",
    swatch: ["#d8ecff", "#5aa7ff", "#5b4bff"],
  },
  {
    id: "cosmos",
    name: "全息宇宙",
    description: "星云、星流、极光带、陨石与彗星全开",
    swatch: ["#29dbff", "#9f61ff", "#ff47bd"],
  },
  {
    id: "voyage",
    name: "星际航行",
    description: "穿越极光带与星流，彗星和流星不断掠过",
    swatch: ["#75e6f2", "#7b61ff", "#ff8a5c"],
  },
  {
    id: "ribbons",
    name: "极光光带",
    description: "深空星云中缓慢流动的彩色光带",
    swatch: ["#36dcff", "#ff47bd", "#ffd27a"],
  },
  {
    id: "asteroids",
    name: "陨石行星",
    description: "高速穿越小行星带与环状行星",
    swatch: ["#9ee0ff", "#5c68ff", "#ff6ad5"],
  },
  {
    id: "nebula",
    name: "深空星云",
    description: "安静的星云与闪烁星海，适合抒情歌",
    swatch: ["#1e6fff", "#8a4dff", "#ff5bb0"],
  },
];

export function isVisualizer3DStyle(value: unknown): value is Visualizer3DStyle {
  return typeof value === "string" && VISUALIZER_3D_STYLES.some((style) => style.id === value);
}

export function getVisualizer3DStyle(id: Visualizer3DStyle): Visualizer3DStyleDef {
  return VISUALIZER_3D_STYLES.find((style) => style.id === id) ?? VISUALIZER_3D_STYLES[0];
}
