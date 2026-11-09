<template>
  <canvas ref="canvasRef" class="star-field"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let raf = 0
let stars: { x: number; y: number; r: number; vx: number; vy: number; tw: number; ph: number }[] = []

const init = () => {
  const c = canvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return

  const resize = () => {
    c.width = window.innerWidth
    c.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)

  stars = Array.from({ length: 130 }, () => ({
    x: Math.random() * c.width,
    y: Math.random() * c.height,
    r: Math.random() * 1.4 + 0.3,
    vx: (Math.random() - 0.5) * 0.06,
    vy: (Math.random() - 0.5) * 0.06,
    tw: Math.random() * 0.02 + 0.005,
    ph: Math.random() * Math.PI * 2
  }))

  const tick = (t: number) => {
    ctx.clearRect(0, 0, c.width, c.height)
    for (const s of stars) {
      s.x += s.vx
      s.y += s.vy
      if (s.x < 0) s.x = c.width
      if (s.x > c.width) s.x = 0
      if (s.y < 0) s.y = c.height
      if (s.y > c.height) s.y = 0
      const a = 0.3 + 0.45 * Math.abs(Math.sin(t * s.tw * 0.06 + s.ph))
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(160, 210, 255, ${a.toFixed(3)})`
      ctx.fill()
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

onMounted(init)
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<style scoped>
.star-field {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
</style>
