export type XkVisualizerStyle = "cosmos" | "voyage";

export type CustomVisualizerStyle =
  | "horizon"
  | "liquid"
  | "tunnel"
  | "kaleidoscope"
  | "ocean"
  | "skyline"
  | "fluid"
  | "attractor"
  | "mandelbulb"
  | "morph";

export type Visualizer3DStyle = "galaxy" | XkVisualizerStyle | CustomVisualizerStyle;

export interface Visualizer3DStyleDef {
  id: Visualizer3DStyle;
  name: string;
  description: string;
  swatch: [string, string, string];
}

export const XK_VISUALIZER_STYLES: XkVisualizerStyle[] = [
  "cosmos",
  "voyage",
];

export const CUSTOM_VISUALIZER_STYLES: CustomVisualizerStyle[] = [
  "horizon",
  "liquid",
  "tunnel",
  "kaleidoscope",
  "ocean",
  "skyline",
  "fluid",
  "attractor",
  "mandelbulb",
  "morph",
];

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
    id: "horizon",
    name: "音浪地平线",
    description: "频谱化作霓虹山脉，条纹落日随鼓点脉动",
    swatch: ["#ff3f9a", "#ff8a3d", "#36e6ff"],
  },
  {
    id: "liquid",
    name: "液态金属球",
    description: "虹彩液态金属随低音翻涌变形",
    swatch: ["#cfe6ff", "#7f8dff", "#ff7ad9"],
  },
  {
    id: "tunnel",
    name: "频谱隧道",
    description: "环形频谱组成无尽隧道，低音轰出冲击波",
    swatch: ["#37f5ff", "#7a5cff", "#ff4fd8"],
  },
  {
    id: "kaleidoscope",
    name: "霓虹万花筒",
    description: "八重镜像的霓虹几何，鼓点翻折镜面",
    swatch: ["#ff4fd8", "#38e8ff", "#ffd166"],
  },
  {
    id: "ocean",
    name: "声波海洋",
    description: "黄昏海面随声波起伏，低音掀起浪潮",
    swatch: ["#ff9a5c", "#ff5f8f", "#2a7fff"],
  },
  {
    id: "skyline",
    name: "赛博都市",
    description: "雨夜霓虹楼群随频谱呼吸生长",
    swatch: ["#5c34ff", "#ff3fa0", "#26e0ff"],
  },
  {
    id: "fluid",
    name: "染料流体",
    description: "虹彩染料在深空中缓慢扩散缠绕",
    swatch: ["#1a3cff", "#ff3fd2", "#ffc857"],
  },
  {
    id: "attractor",
    name: "奇异吸引子",
    description: "百万粒子沿奇异轨迹翻涌旋转，低音激起湍流",
    swatch: ["#8f6bff", "#38e0ff", "#ffffff"],
  },
  {
    id: "mandelbulb",
    name: "分形曼德球",
    description: "光线步进的分形世界，节拍点亮棱面",
    swatch: ["#2ee6c8", "#b45cff", "#ff4fa0"],
  },
  {
    id: "morph",
    name: "粒子成型",
    description: "粒子在星球、环面与心形之间流动变换",
    swatch: ["#5aa7ff", "#38e8ff", "#ffffff"],
  },
];

export function isXkVisualizerStyle(value: Visualizer3DStyle): value is XkVisualizerStyle {
  return (XK_VISUALIZER_STYLES as string[]).includes(value);
}

export function isCustomVisualizerStyle(value: Visualizer3DStyle): value is CustomVisualizerStyle {
  return (CUSTOM_VISUALIZER_STYLES as string[]).includes(value);
}

export function isVisualizer3DStyle(value: unknown): value is Visualizer3DStyle {
  return typeof value === "string" && VISUALIZER_3D_STYLES.some((style) => style.id === value);
}

export function getVisualizer3DStyle(id: Visualizer3DStyle): Visualizer3DStyleDef {
  return VISUALIZER_3D_STYLES.find((style) => style.id === id) ?? VISUALIZER_3D_STYLES[0];
}
