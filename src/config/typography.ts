/**
 * 大屏字号统一放大系数。
 * 与 src/styles/global.css 里的 --font-boost-sm / md / lg 保持一致，改一处要同步改另一处。
 *
 * 背景：整个页面在 .screen-wrapper 里按视口缩放（transform: scale），设计稿里
 * 12~13px 的字在缩小的预览视口上会非常小；而挂在 body 上的浮层不参与缩放，
 * 于是「页面字太小、弹窗浮层字太大」同时出现。
 *
 * 分档放大的原因：大数字（20px 以上）本来就容易撑破卡片，只小幅提升；
 * 正文与小标签（13px 及以下）是「看不清」的主要来源，提升最多。
 */
export const FONT_BOOST = {
  sm: 1.28,
  md: 1.2,
  lg: 1.12
} as const

/**
 * ECharts 用 canvas 绘制文字，不受 CSS 变量影响，需要在 setOption 里显式放大。
 * tight=true 用于斜排刻度、窄列标签这类「字一大就互相压住」的位置，只小幅提升。
 */
export function chartFont(px: number, tight = false): number {
  const boost = tight ? 1.08 : px <= 13 ? FONT_BOOST.sm : px <= 19 ? FONT_BOOST.md : FONT_BOOST.lg
  return Math.round(px * boost)
}
