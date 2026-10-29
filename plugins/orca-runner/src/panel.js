(() => {
  'use strict'
  const $ = id => document.getElementById(id)
  const canvas = $('game')
  const copy = {
    ready: ['READY TO GO', 'THE OCEAN IS CALLING', 'Ready, little orca?', 'Jump the ice. Find your flow.', "Let's go", 'Your next adventure starts here.'],
    running: ['IN THE FLOW', '', '', '', 'Jump', 'Jump icebergs. Duck the seabirds.'],
    paused: ['TAKING A BREATHER', 'NO RUSH', 'Catch your breath.', 'Your ocean will be right here.', 'Keep going', 'Paused. Press P or resume when ready.'],
    gameover: ['NICE SWIM', 'ONE MORE WAVE?', 'Back for another?', 'Every great run starts with a splash.', 'Try again', 'A splash is just a new beginning.']
  }
  const format = value => String(value).padStart(5, '0')
  const game = window.createOrcaRunner({
    canvas,
    onScore(score, best) {
      $('score').textContent = format(score)
      $('best').textContent = format(best)
    },
    onStateChange(state) {
      const [status, label, title, hint, action, message] = copy[state]
      document.body.dataset.state = state
      $('status').textContent = status
      $('overlay-label').textContent = label
      $('overlay-title').textContent = title
      $('overlay-hint').textContent = hint
      $('overlay').hidden = state === 'running'
      $('start-text').textContent = action
      $('run-message').textContent = message
      $('pause').disabled = state === 'ready' || state === 'gameover'
      $('pause').setAttribute('aria-label', state === 'paused' ? 'Resume game' : 'Pause game')
      $('pause').title = state === 'paused' ? 'Resume (P)' : 'Pause (P)'
      $('pause-symbol').textContent = state === 'paused' ? '▶' : 'Ⅱ'
      $('action-hint').innerHTML = state === 'paused' ? 'or press <kbd>P</kbd>' : 'or press <kbd>space</kbd>'
      if (state !== 'running') $('announcement').textContent = state === 'gameover' ? `Run over. Score ${$('score').textContent}. Select Try again to restart.` : message
    }
  })
  function focusGame() { canvas.focus({ preventScroll: true }) }
  $('start').addEventListener('click', () => {
    if (game.getState() === 'running') game.jump()
    else game.start()
    focusGame()
  })
  $('pause').addEventListener('click', () => { game.togglePause(); focusGame() })
  const jumpKeys = new Set(['Space', 'ArrowUp'])
  document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest('button, input, textarea, select, [contenteditable="true"]')) return
    if (jumpKeys.has(event.code)) {
      event.preventDefault()
      if (!event.repeat) game.jump()
    } else if (event.code === 'ArrowDown') {
      event.preventDefault()
      game.setDucking(true)
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      event.preventDefault()
      if (!event.repeat) game.togglePause()
    }
  })
  document.addEventListener('keyup', event => {
    if (jumpKeys.has(event.code)) game.releaseJump()
    if (event.code === 'ArrowDown') game.setDucking(false)
  })
  function bindHold(element, down, up) {
    element.addEventListener('pointerdown', event => {
      if (event.button !== 0) return
      event.preventDefault()
      element.setPointerCapture(event.pointerId)
      focusGame()
      down()
    })
    element.addEventListener('pointerup', up)
    element.addEventListener('pointercancel', up)
    element.addEventListener('lostpointercapture', up)
  }
  bindHold(canvas, () => game.jump(), () => game.releaseJump())
  bindHold($('jump'), () => game.jump(), () => game.releaseJump())
  bindHold($('duck'), () => game.setDucking(true), () => game.setDucking(false))
  // Preserve normal keyboard activation for the touch buttons.
  $('jump').addEventListener('click', event => { if (event.detail === 0) { game.jump(); game.releaseJump(); focusGame() } })
  $('duck').addEventListener('keydown', event => { if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); game.setDucking(true) } })
  $('duck').addEventListener('keyup', () => game.setDucking(false))
  $('duck').addEventListener('blur', () => game.setDucking(false))
  function pauseAway() { game.setDucking(false); game.releaseJump(); game.pause() }
  window.addEventListener('blur', pauseAway)
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAway() })
  let resizeFrame = null
  let observedWidth = $('playfield').getBoundingClientRect().width
  const resize = new ResizeObserver(entries => {
    const width = entries[0].contentRect.width
    if (Math.abs(width - observedWidth) < 0.5) return
    observedWidth = width
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => { resizeFrame = null; game.resize() })
  })
  resize.observe($('playfield'))
  const theme = new MutationObserver(() => game.resize())
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
  window.addEventListener('pagehide', () => { resize.disconnect(); theme.disconnect(); if (resizeFrame !== null) cancelAnimationFrame(resizeFrame); game.destroy() }, { once: true })
})()
