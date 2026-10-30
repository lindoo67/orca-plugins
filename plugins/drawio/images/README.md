# 图片资源

本次资源使用内置 imagegen 工具生成图标和封面，再用浏览器 Canvas 进行尺寸导出及 WebP 编码。未使用 CLI/API 回退。图标为本插件原创图形，没有使用官方 draw.io 标识。封面为宣传插画，不能作为界面截图。

| 文件 | 用途 | 尺寸 |
| --- | --- | --- |
| icon.png | 市场图标 | 256×256 |
| tab-icon.png | 文件标签、新建文件菜单图标 | 128×128 |
| cover.webp | 市场封面 | 1600×1000 |
| editing-light.png | 真实编辑器浅色截图 | 1600×1000 |
| editing-dark.png | 真实编辑器深色截图 | 1600×1000 |
| editing-selection.png | 真实编辑器选中节点截图 | 1600×1000 |

截图由 `build/preview.mjs` 在与 Orca 相同 CSP 的浏览器沙箱中运行插件后截取，内容是演示图表；没有伪造 Orca 应用外框。`editor-dark.png` 是开发阶段的旧预览，保留但不再注册为市场截图。

## 图标最终提示词

Create one square 1024x1024 raster application icon for an independent offline diagram editor plugin by LinDoo. Minimal polished professional software icon: dark midnight navy rounded-square tile, a bold geometric flowchart consisting of three softly rounded ivory rectangles connected by thick clean orange right-angle connectors, a single small cyan accent node. Extremely simple silhouette legible at 24px, flat vector-like finish with subtle depth and restrained warm glow, generous inset margins. Centered symmetrical balanced composition. No letters, no words, no watermark. Original symbol, do not copy the official draw.io logo. Deliver a single icon filling the square image, opaque background. Intended filename icon.png.

## 封面最终提示词

Create one landscape 1600x1000 marketplace cover illustration for 'Draw.io' independent offline diagram editor plugin by 'LinDoo'. Refined editorial software illustration, not an actual screenshot. Deep midnight navy background with very subtle engineering dot grid. Main visual is a beautifully arranged floating diagram canvas with ivory rounded rectangles, orange orthogonal connectors, a few cyan and muted teal process nodes, small layered sheets suggesting multi-page diagrams, crisp readable shapes and tasteful soft shadows. Strong clear hierarchy and ample breathing room. On left upper area elegant large white heading exactly 'Draw.io' with smaller text exactly 'by LinDoo' beneath, and one understated small text line exactly 'Offline diagram editor'. Diagram composition on center and right. Contemporary premium developer tool aesthetic, restrained flat vector-like illustration with slight dimensional depth, orange and cyan accent palette consistent with professional flowchart app. No browser chrome, no invented UI controls, no official draw.io logo, no Orca logo, no watermark, no additional text. Fully opaque image. This is a promotional illustration, not a feature screenshot.
