import { onBeforeUnmount, onMounted, nextTick, watch, type Ref } from 'vue'

interface AutoScrollOptions {
  /** 每个 tick（40ms）滚动的像素数，默认 1 */
  speed?: number
  /** 滚到底部后停留多久回到顶部，默认 1200ms */
  resetDelay?: number
}

/**
 * 大屏列表自动滚动：匀速下滚，鼠标移入暂停、移出继续，
 * 滚到底后短暂停顿再回到顶部；列表数据变化时自动重新绑定。
 *
 * 原型批注：「直接获取所有，然后滚动，鼠标放上去后静止」。
 * 需要 el-table 设置了 height（或父容器限高）才会有可滚动的 .el-scrollbar__wrap。
 * 用 setInterval 而非 requestAnimationFrame：后台/无头标签页里 rAF 会被暂停。
 */
export function useTableAutoScroll(
  host: Ref<HTMLElement | null>,
  itemCount: () => number,
  options: AutoScrollOptions = {}
) {
  const { speed = 1, resetDelay = 1200 } = options
  let wrap: HTMLElement | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let paused = false
  let resetting = false
  let resetTimer: ReturnType<typeof setTimeout> | null = null

  const pause = () => { paused = true }
  const resume = () => { paused = false }

  const detach = () => {
    const el = host.value
    if (el) {
      el.removeEventListener('mouseenter', pause)
      el.removeEventListener('mouseleave', resume)
    }
    wrap = null
  }

  const tick = () => {
    if (!wrap || paused || resetting) return
    const max = wrap.scrollHeight - wrap.clientHeight
    if (max <= 1) return
    if (wrap.scrollTop >= max - 1) {
      resetting = true
      resetTimer = setTimeout(() => {
        if (wrap) wrap.scrollTop = 0
        resetting = false
        resetTimer = null
      }, resetDelay)
    } else {
      wrap.scrollTop = Math.min(wrap.scrollTop + speed, max)
    }
  }

  /** el-table 的滚动容器可能晚一帧才出现，找不到时做有限次重试 */
  const bind = async (retry = 0) => {
    detach()
    await nextTick()
    const el = host.value
    if (!el) return
    wrap = el.querySelector<HTMLElement>('.el-scrollbar__wrap')
    if (!wrap) {
      if (retry < 6) setTimeout(() => void bind(retry + 1), 300)
      return
    }
    el.addEventListener('mouseenter', pause)
    el.addEventListener('mouseleave', resume)
    wrap.scrollTop = 0
  }

  onMounted(() => {
    void bind()
    timer = setInterval(tick, 40)
  })
  watch(itemCount, () => { void bind() })
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    if (resetTimer) clearTimeout(resetTimer)
    detach()
  })
}
