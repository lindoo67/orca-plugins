(() => {
  'use strict'
  const $ = id => document.getElementById(id)
  const canvas = $('game')
  const copy = {
    ready: ['READY TO GO', 'THE OCEAN IS CALLING', 'Ready, little orca?', 'Jump the ice. Find your flow.', "Let's go", 'Hold jump for airtime. Dive under seabirds.'],
    running: ['IN THE FLOW', '', '', '', 'Jump', 'Jump icebergs. Dive under the seabirds.'],
    paused: ['TAKING A BREATHER', 'NO RUSH', 'Catch your breath.', 'Your ocean will be right here.', 'Keep going', 'Paused. Press P or resume when ready.'],
    gameover: ['NICE SWIM', 'ONE MORE WAVE?', 'Back for another?', 'Every great run starts with a splash.', 'Try again', 'A splash is just a new beginning.']
  }
  // Chunky 6×7 pixel letters echo the cover art's wordmark.
  const glyphs = {
    O: ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
    R: ['#####.', '##..##', '##..##', '#####.', '##.##.', '##..##', '##..##'],
    C: ['.#####', '##....', '##....', '##....', '##....', '##....', '.#####'],
    A: ['.####.', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
    U: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
    N: ['##..##', '###.##', '######', '##.###', '##..##', '##..##', '##..##'],
    E: ['######', '##....', '##....', '#####.', '##....', '##....', '######']
  }
  function pixelPath(word, left) {
    let path = ''
    for (const [index, letter] of [...word].entries()) {
      glyphs[letter].forEach((row, y) => [...row].forEach((cell, x) => {
        if (cell === '#') path += `M${left + index * 7 + x} ${y}h1v1h-1z`
      }))
    }
    return path
  }
  function drawWordmark() {
    const svg = $('wordmark')
    const ink = pixelPath('ORCA', 0)
    const tint = pixelPath('RUNNER', 30)
    svg.setAttribute('viewBox', '0 0 72 7.6')
    svg.innerHTML = `<path class="shade" transform="translate(.45 .45)" d="${ink}${tint}"/><path class="ink" d="${ink}"/><path class="tint" d="${tint}"/>`
  }
  drawWordmark()

  const format = value => String(value).padStart(5, '0')
  let bestBeforeRun = 0
  let lastScore = 0
  const game = window.createOrcaRunner({
    canvas,
    onScore(score, best) {
      $('score').textContent = format(score)
      $('best').textContent = format(best)
      // Blink the score at every hundred, like a little arcade fanfare.
      if (score > 0 && Math.floor(score / 100) > Math.floor(lastScore / 100)) {
        $('score').classList.remove('flash')
        void $('score').offsetWidth
        $('score').classList.add('flash')
      }
      lastScore = score
    },
    onStateChange(state) {
      const previous = document.body.dataset.state
      const best = Number($('best').textContent)
      const newBest = state === 'gameover' && best > 0 && best > bestBeforeRun
      if (state === 'running' && previous !== 'paused') bestBeforeRun = best
      const [status, label, title, hint, action, message] = copy[state]
      document.body.dataset.state = state
      document.body.toggleAttribute('data-new-best', newBest)
      $('status').textContent = status
      $('overlay-label').textContent = newBest ? `NEW BEST · ${format(best)}` : label
      $('overlay-title').textContent = newBest ? 'What a swim!' : title
      $('overlay-hint').textContent = hint
      $('overlay').hidden = state === 'running'
      $('start-text').textContent = action
      $('run-message').textContent = message
      $('pause').disabled = state === 'ready' || state === 'gameover'
      $('pause').setAttribute('aria-label', state === 'paused' ? 'Resume game' : 'Pause game')
      $('pause').title = state === 'paused' ? 'Resume (P)' : 'Pause (P)'
      $('action-hint').textContent = state === 'paused' ? 'P' : 'Space'
      if (state !== 'running') {
        pressed($('jump'), false)
        pressed($('duck'), false)
        $('announcement').textContent = state === 'gameover' ? `Run over. Score ${$('score').textContent}.${newBest ? ' New best!' : ''} Select Try again to restart.` : message
      }
    }
  })
  function focusGame() { canvas.focus({ preventScroll: true }) }
  function pressed(element, value) { element.classList.toggle('pressed', value) }
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
      pressed($('jump'), game.getState() === 'running')
    } else if (event.code === 'ArrowDown') {
      event.preventDefault()
      game.setDucking(true)
      pressed($('duck'), game.getState() === 'running')
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      event.preventDefault()
      if (!event.repeat) game.togglePause()
    }
  })
  document.addEventListener('keyup', event => {
    if (jumpKeys.has(event.code)) { game.releaseJump(); pressed($('jump'), false) }
    if (event.code === 'ArrowDown') { game.setDucking(false); pressed($('duck'), false) }
  })
  function bindHold(element, down, up) {
    const release = () => { pressed(element, false); up() }
    element.addEventListener('pointerdown', event => {
      if (event.button !== 0) return
      event.preventDefault()
      element.setPointerCapture(event.pointerId)
      focusGame()
      pressed(element, element !== canvas)
      down()
    })
    element.addEventListener('pointerup', release)
    element.addEventListener('pointercancel', release)
    element.addEventListener('lostpointercapture', release)
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
