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
    let ink = '#23313b';
    let orcaBody = '#203b3b';
    let water = '#64b9c7';
    let muted = '#889ba3';

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
      context.strokeStyle = muted;
      context.lineWidth = 1.25;
      // A broad head, dorsal fin, white saddle and two-lobed tail keep the silhouette unmistakable.
      polygon([[3,-18],[0,-29],[10,-38],[37,-43],[56,-38],[66,-29],[68,-15],[57,-6],[22,-4],[9,-10]], orcaBody);
      context.stroke();
      polygon([[27,-40],[32,-59],[38,-54],[43,-40]], orcaBody);
      context.stroke();
      polygon([[8,-18],[-8,-18+tailLift],[-20,-31+tailLift],[-21,-18+tailLift],[-14,-10+tailLift],[-23,-1+tailLift],[-10,-1+tailLift],[3,-10]], orcaBody);
      context.stroke();
      polygon([[16,-12],[28,-12],[40,-18],[58,-18],[62,-12],[54,-7],[25,-5]], '#ffffff');
      polygon([[43,-33],[50,-35],[57,-31],[55,-26],[48,-26],[43,-29]], '#ffffff');
      rect(59,-29,3,3,'#ffffff');
      rect(60,-29,2,2,orcaBody);
      polygon([[31,-16],[39,-14],[40,-2],[35,0],[28,-9]], orcaBody);
      context.restore();
    }
    function drawIce(obstacle) {
      const x = obstacle.x;
      const top = GROUND - obstacle.height;
      polygon([[x,GROUND],[x+3,top+12],[x+12,top],[x+22,top+8],[x+obstacle.width,GROUND]], water);
      polygon([[x+3,top+12],[x+12,top],[x+22,top+8],[x+16,top+17],[x+11,top+12]], '#ffffff');
      rect(x+8,top+22,3,8,ink);
      rect(x+11,top+28,5,2,ink);
    }
    function drawBird(obstacle) {
      const flap = Math.sin(distance / 24) > 0 ? -9 : 7;
      const x = obstacle.x;
      const y = obstacle.y;
      polygon([[x,y+8],[x+10,y+3],[x+22,y+5],[x+29,y+10],[x+19,y+15],[x+7,y+13]], ink);
      polygon([[x+12,y+8],[x+7,y+flap],[x+18,y+flap+2],[x+22,y+9]], ink);
      polygon([[x+27,y+8],[x+34,y+11],[x+27,y+12]], water);
    }
    function draw() {
      if (destroyed) return;
      const styles = window.getComputedStyle(canvas);
      ink = styles.getPropertyValue('--game-ink').trim() || '#23313b';
      orcaBody = styles.getPropertyValue('--game-orca-body').trim() || '#203b3b';
      water = styles.getPropertyValue('--game-water').trim() || '#64b9c7';
      muted = styles.getPropertyValue('--game-muted').trim() || '#889ba3';
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, WIDTH, HEIGHT);
      // Scenery scrolls more slowly than hazards, leaving the play area readable.
      for (let i = 0; i < 5; i++) {
        const x = ((i * 179 + 60 - distance * 0.12) % 900 + 900) % 900 - 70;
        rect(x, 55+(i%3)*19, 29, 2, muted);
        rect(x+8, 50+(i%3)*19, 14, 2, muted);
      }
      rect(0, GROUND, WIDTH, 2, water);
      for (let i = 0; i < 21; i++) {
        const x = ((i*43-distance*0.65)%903+903)%903-80;
        rect(x, GROUND+13+(i%3)*8, 11+(i%3)*7, 2, water);
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
      canvas.width = Math.round(width*ratio);
      canvas.height = Math.round(width*HEIGHT/WIDTH*ratio);
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      scale = canvas.width/WIDTH;
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
