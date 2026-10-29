(() => {
  'use strict'
  const canvas = document.getElementById('game')
  const announcement = document.getElementById('announcement')
  // The canvas shows score and prompts; this live region repeats them for screen readers.
  const messages = {
    running: 'Swimming. Space to jump, down arrow to dive.',
    paused: 'Paused. Press space or P to keep going.'
  }
  let score = 0
  let bestBeforeRun = 0
  let best = 0
  const game = window.createOrcaRunner({
    canvas,
    onScore(value, record) { score = value; best = record },
    onStateChange(state) {
      if (state === 'running' && score === 0) bestBeforeRun = best
      if (state === 'gameover') announcement.textContent = `Run over. Score ${score}.${score > bestBeforeRun ? ' New best!' : ''} Press space to swim again.`
      else if (messages[state]) announcement.textContent = messages[state]
    }
  })
  const jumpKeys = new Set(['Space', 'ArrowUp'])
  // Some webviews and synthesized key events provide key without a physical code.
  const keyCodes = { ' ': 'Space', p: 'KeyP', P: 'KeyP' }
  const keyCode = event => event.code || keyCodes[event.key] || event.key
  document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest('button, input, textarea, select, [contenteditable="true"]')) return
    const code = keyCode(event)
    if (jumpKeys.has(code)) {
      event.preventDefault()
      if (!event.repeat) game.jump()
    } else if (code === 'ArrowDown') {
      event.preventDefault()
      if (!event.repeat) game.setDucking(true)
    } else if (code === 'KeyP' || code === 'Escape') {
      event.preventDefault()
      if (!event.repeat) game.togglePause()
    }
  })
  document.addEventListener('keyup', event => {
    const code = keyCode(event)
    if (jumpKeys.has(code)) game.releaseJump()
    if (code === 'ArrowDown') game.setDucking(false)
  })
  // Tap or click the ocean to jump; holding gives more airtime.
  const release = () => game.releaseJump()
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    event.preventDefault()
    canvas.setPointerCapture(event.pointerId)
    canvas.focus({ preventScroll: true })
    game.jump()
  })
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)
  canvas.addEventListener('lostpointercapture', release)
  function pauseAway() { game.setDucking(false); game.releaseJump(); game.pause() }
  window.addEventListener('blur', pauseAway)
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAway() })
  let resizeFrame = null
  let observedWidth = document.getElementById('playfield').getBoundingClientRect().width
  const resize = new ResizeObserver(entries => {
    const width = entries[0].contentRect.width
    if (Math.abs(width - observedWidth) < 0.5) return
    observedWidth = width
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => { resizeFrame = null; game.resize() })
  })
  resize.observe(document.getElementById('playfield'))
  const theme = new MutationObserver(() => game.resize())
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
  window.addEventListener('pagehide', () => { resize.disconnect(); theme.disconnect(); if (resizeFrame !== null) cancelAnimationFrame(resizeFrame); game.destroy() }, { once: true })
})()
