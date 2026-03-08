

## Fix /ai-video page to match app aesthetic (image 2 reference)

The reference (21M Finances) has: **dark navy sidebar**, **light blue/lavender canvas background** (`--background-outer: hsl(230, 100%, 94%)`), and **white cards**. Currently the /ai-video page is all white/light gray.

### Changes

**1. `src/pages/AIVideo.tsx`**
- Canvas area: change `bg-background` to use the light blue outer background (`bg-[hsl(230,100%,94%)]` or use the CSS var `--background-outer`)
- Header: keep white (`bg-card`) — already matches
- ReactFlow `className`: use the light blue background instead of white

**2. `src/components/ai-video/AssetSidebar.tsx`**
- Main sidebar: dark navy background (`bg-[hsl(219,61%,26%)]`) with white text — matching the reference dark sidebar
- Collapsed sidebar: same dark navy
- Tabs, inputs, buttons: adapt text/border colors for dark background (white/light text, subtle borders)
- Asset grid items: keep light card backgrounds for contrast

**3. Node components stay the same** — they're already white cards which will look correct against the light blue canvas background.

All changes scoped to `/ai-video` page components only. Uses existing CSS variables (`--background-outer`, `--login-background`) already defined in the design system.

