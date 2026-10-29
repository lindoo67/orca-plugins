/* Orca Runner — original canvas game. Copyright (c) 2026 Orca contributors. MIT. */
(function () {
  'use strict';
  const WIDTH = 720;
  const HEIGHT = 280;
  const GROUND = 210;
  const PLAYER_X = 82;
  const GRAVITY = 1450;
  const JUMP_VELOCITY = 505;

  window.createOrcaRunner = function ({ canvas, onStateChange = function () {}, onScore = function () {} }) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Orca Runner needs a 2D canvas.');
    let state = 'ready';
    let frame = null;
    let lastTime = null;
    let distance = 0;
    let score = 0;
    let best = 0;
    let height = 0;
    let velocity = 0;
    let ducking = false;
    let obstacles = [];
    let untilSpawn = 1.8;
    let destroyed = false;
    let scale = 1;
    let viewportWidth = WIDTH;
    let ink = '#23313b';
    let orcaBody = '#203b3b';
    let water = '#64b9c7';
    let sky = '#edf8fc';
    let ice = '#ffffff';
    let iceShade = '#79c5e4';

    function setState(next) {
      if (state === next) return;
      state = next;
      onStateChange(state);
    }
    function cancelFrame() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      lastTime = null;
    }
    function scheduleFrame() {
      if (!destroyed && state === 'running' && frame === null) frame = window.requestAnimationFrame(tick);
    }
    function polygon(points, color) {
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      for (let index = 1; index < points.length; index++) context.lineTo(points[index][0], points[index][1]);
      context.closePath();
      context.fill();
    }
    function rect(x, y, w, h, color) {
      context.fillStyle = color;
      context.fillRect(x, y, w, h);
    }
    function drawOrca() {
      context.save();
      context.translate(PLAYER_X, GROUND - height);
      if (ducking && height === 0) context.scale(1.05, 0.56);
      const tailLift = state === 'running' ? Math.sin(distance / 35) * 3 : 0;
      // Smooth, compact silhouette with the eye patch, white belly and swept dorsal fin.
      context.fillStyle = orcaBody;
      context.beginPath();
      context.moveTo(0,-20);
      context.bezierCurveTo(9,-43,44,-49,61,-35);
      context.bezierCurveTo(72,-28,73,-16,61,-10);
      context.bezierCurveTo(43,1,12,-2,0,-20);
      context.fill();
      context.beginPath();
      context.moveTo(24,-39);
      context.quadraticCurveTo(27,-54,22,-60);
      context.quadraticCurveTo(41,-57,42,-41);
      context.fill();
      polygon([[8,-18],[-8,-18+tailLift],[-20,-31+tailLift],[-21,-18+tailLift],[-14,-10+tailLift],[-23,-1+tailLift],[-10,-1+tailLift],[3,-10]], orcaBody);
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.moveTo(12,-12);
      context.bezierCurveTo(33,-5,39,-21,68,-21);
      context.bezierCurveTo(69,-6,34,4,12,-12);
      context.fill();
      context.beginPath();
      context.ellipse(49,-31,9,4,-0.2,0,Math.PI*2);
      context.fill();
      context.beginPath();
      context.arc(63,-27,2,0,Math.PI*2);
      context.fill();
      rect(63,-28,1,2,orcaBody);
      polygon([[29,-17],[43,-15],[35,-1],[28,2],[27,-7]], orcaBody);
      if (height === 0) {
        rect(-22,-1,12,2,'#ffffff');
        rect(-32,-6,5,2,'#ffffff');
      }
      context.restore();
    }
    function drawIce(obstacle) {
      const x = obstacle.x;
      const top = GROUND - obstacle.height;
      polygon([[x,GROUND],[x+3,top+12],[x+12,top],[x+22,top+8],[x+obstacle.width,GROUND]], ice);
      polygon([[x+12,top],[x+22,top+8],[x+obstacle.width,GROUND],[x+16,GROUND]], iceShade);
      polygon([[x+3,top+12],[x+12,top],[x+8,GROUND],[x,GROUND]], '#b9e5f3');
      polygon([[x+12,top+6],[x+16,top+18],[x+13,top+15],[x+17,GROUND-4],[x+10,GROUND-9]], '#d9f2fa');
      rect(x-4,GROUND,obstacle.width+8,2,'#ffffff');
    }
    function drawBird(obstacle) {
      const flap = Math.sin(distance / 24) > 0 ? -9 : 7;
      const x = obstacle.x;
      const y = obstacle.y;
      polygon([[x,y+8],[x+10,y+3],[x+22,y+5],[x+29,y+10],[x+19,y+15],[x+7,y+13]], ink);
      polygon([[x+7,y+8],[x+12,y+4],[x+24,y+6],[x+28,y+11],[x+16,y+12]], '#ffffff');
      polygon([[x+12,y+8],[x+7,y+flap],[x+18,y+flap+2],[x+22,y+9]], '#36536c');
      polygon([[x+27,y+8],[x+34,y+11],[x+27,y+12]], '#ef986e');
    }
    function draw() {
      if (destroyed) return;
      const styles = window.getComputedStyle(canvas);
      ink = styles.getPropertyValue('--game-ink').trim() || '#23313b';
      orcaBody = styles.getPropertyValue('--game-orca-body').trim() || '#203b3b';
      water = styles.getPropertyValue('--game-water').trim() || '#64b9c7';
      sky = styles.getPropertyValue('--game-sky').trim() || '#edf8fc';
      ice = styles.getPropertyValue('--game-ice').trim() || '#ffffff';
      iceShade = styles.getPropertyValue('--game-ice-shade').trim() || '#79c5e4';
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, WIDTH, HEIGHT);
      rect(0,0,WIDTH,HEIGHT,sky);
      context.fillStyle = ice;
      context.beginPath();
      context.arc(viewportWidth-70,47,23,0,Math.PI*2);
      context.fill();
      // Quiet distant peaks and two water layers add depth without hiding hazards.
      for (let i = 0; i < 7; i++) {
        const x = ((i*137-distance*0.06)%960+960)%960-150;
        polygon([[x,GROUND-24],[x+53,121+(i%3)*12],[x+133,GROUND-24]], '#b9dce9');
        polygon([[x+53,121+(i%3)*12],[x+68,164],[x+49,152],[x+30,171]], ice);
      }
      rect(0,GROUND-24,WIDTH,94,water);
      rect(0,GROUND+25,WIDTH,45,iceShade);
      // Scenery scrolls more slowly than hazards, leaving the play area readable.
      for (let i = 0; i < 5; i++) {
        const x = ((i * 179 + 60 - distance * 0.12) % 900 + 900) % 900 - 70;
        rect(x, 55+(i%3)*19, 39, 3, ice);
        rect(x+8, 50+(i%3)*19, 18, 5, ice);
      }
      rect(0, GROUND, WIDTH, 2, ice);
      for (let i = 0; i < 21; i++) {
        const x = ((i*43-distance*0.65)%903+903)%903-80;
        rect(x, GROUND+13+(i%3)*15, 11+(i%3)*7, 2, '#b9e5f3');
      }
      for (const obstacle of obstacles) {
        if (obstacle.kind === 'bird') drawBird(obstacle);
        else drawIce(obstacle);
      }
      drawOrca();
      if (state === 'gameover') {
        rect(PLAYER_X+20, GROUND-30-height, 3, 3, water);
        rect(PLAYER_X+27, GROUND-35-height, 3, 3, water);
      }
    }
    function intersects(a, b) {
      return a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
    }
    function update(dt) {
      const speed = Math.min(430, 255+distance*0.009);
      distance += speed*dt;
      const nextScore = Math.floor(distance/10);
      if (nextScore !== score) {
        score = nextScore;
        best = Math.max(best, score);
        onScore(score,best);
      }
      if (height > 0 || velocity > 0) {
        velocity -= GRAVITY*dt;
        height = Math.max(0,height+velocity*dt);
        if (height === 0 && velocity < 0) velocity = 0;
      }
      untilSpawn -= dt;
      if (untilSpawn <= 0) {
        const bird = score > 180 && Math.random() < 0.3;
        obstacles.push(bird
          ? {kind:'bird',x:WIDTH+35,y:170,width:30,height:17}
          : {kind:'ice',x:WIDTH+35,y:GROUND-34,width:27,height:34});
        // Space hazards by time, so acceleration cannot create impossible clusters.
        untilSpawn = 1.35+Math.random()*0.75;
      }
      const crouched = ducking && height === 0;
      const player = {x:PLAYER_X+8,y:GROUND-height-(crouched?19:37),width:51,height:crouched?15:31};
      for (const obstacle of obstacles) {
        obstacle.x -= speed*dt;
        const hazard = obstacle.kind === 'bird'
          ? {x:obstacle.x+3,y:obstacle.y+4,width:25,height:11}
          : {x:obstacle.x+5,y:GROUND-26,width:17,height:26};
        if (intersects(player,hazard)) {
          ducking = false;
          setState('gameover');
          return;
        }
      }
      obstacles = obstacles.filter(obstacle => obstacle.x+obstacle.width > -25);
    }
    function tick(time) {
      frame = null;
      if (destroyed || state !== 'running') return;
      const dt = lastTime === null ? 0 : Math.max(0,Math.min((time-lastTime)/1000,0.032));
      lastTime = time;
      update(dt);
      draw();
      if (state === 'running') scheduleFrame();
      else lastTime = null;
    }
    function start() {
      if (destroyed || state === 'running') return;
      if (state !== 'paused') {
        distance = 0;
        score = 0;
        height = 0;
        velocity = 0;
        obstacles = [];
        untilSpawn = 1.8;
        onScore(0,best);
      }
      ducking = false;
      lastTime = null;
      setState('running');
      draw();
      scheduleFrame();
    }
    function jump() {
      if (destroyed) return;
      if (state === 'paused') { start(); return; }
      if (state === 'ready' || state === 'gameover') start();
      if (state === 'running' && height === 0 && velocity === 0) {
        ducking = false;
        velocity = JUMP_VELOCITY;
      }
    }
    function pause() {
      if (destroyed || state !== 'running') return;
      ducking = false;
      cancelFrame();
      setState('paused');
      draw();
    }
    function resize() {
      if (destroyed) return;
      const width = Math.max(1,canvas.parentElement.getBoundingClientRect().width);
      const ratio = Math.min(window.devicePixelRatio || 1,3);
      // Crop distant scenery on narrow panels instead of shrinking the orca to a speck.
      // World coordinates, obstacle timing and collision geometry stay the same.
      viewportWidth = Math.min(WIDTH, Math.max(480, width));
      canvas.width = Math.round(width*ratio);
      canvas.height = Math.round(width*HEIGHT/viewportWidth*ratio);
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      scale = canvas.width/viewportWidth;
      draw();
    }
    resize();
    onStateChange(state);
    onScore(score,best);
    return Object.freeze({
      start, jump, pause, resize,
      releaseJump: function () { if (velocity > 190) velocity = 190; },
      setDucking: function (value) {
        ducking = state === 'running' && Boolean(value);
        if (ducking && height > 0) velocity = Math.min(velocity, -330);
        draw();
      },
      togglePause: function () { if (state === 'paused') start(); else pause(); },
      getState: function () { return state; },
      destroy: function () { destroyed = true; cancelFrame(); obstacles = []; }
    });
  };
})();
