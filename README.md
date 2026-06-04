# MusicPlayer

基于 Tauri 2.0 + Solid.js + TypeScript + Tailwind CSS 的音乐播放器。


<div align="center">
  <h3>效果图</h3>
  <table>
    <tr>
      <td><img src="EffectDemonstration/1.png" alt="效果图1" width="400"></td>
      <td><img src="EffectDemonstration/2.png" alt="效果图2" width="400"></td>
    </tr>
    <tr>
      <td><img src="EffectDemonstration/3.png" alt="效果图3" width="400"></td>
      <td><img src="EffectDemonstration/4.png" alt="效果图4" width="400"></td>
    </tr>
  </table>
</div>

## 功能

- 音频播放（MP3, FLAC, WAV, AAC, OGG, M4A）
- 歌词同步（卡拉 OK 逐字高亮 + 翻译）
- Canvas 2D 频谱 / Three.js 3D 粒子可视化
- 媒体库管理（导入单曲/文件夹，分类，收藏，排序）
- 播放队列（拖拽排序，搜索，批量操作）
- 自定义背景图 + 暗色叠加
- 主题色自定义（8 预设 + 取色器）
- 迷你窗口（置顶，固定高度，显示歌词）
- 睡眠定时器
- 跨歌曲淡入淡出
- 系统托盘（右键菜单）
- 状态栏通知

## 开始

```bash
npm install
npm run tauri dev
```

## 构建

```bash
npm run tauri build
```

## 测试

```bash
npm test          # 运行测试
npx tsc --noEmit  # 类型检查
```

## 技术栈

- **前端:** Solid.js, TypeScript, Tailwind CSS, Vite
- **后端:** Rust (Tauri 2.0), lofty (音频标签)
- **可视化:** Canvas 2D, Three.js
- **测试:** Vitest + jsdom
