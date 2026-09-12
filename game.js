(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const messageEl = document.getElementById('message');
  const milestoneEl = document.getElementById('milestone');
  const statusEl = document.getElementById('statusText');
  const ink = '#535353';
  const W = canvas.width, H = canvas.height, groundY = 246;
  const pixel = 3;

  const sprites = {
    dino: [
      '      ######', '     ########', '     ###     ', '     ######  ', '    ######## ', '   ########  ', '  ########   ', '  ######     ', ' ########    ', '########     ', '########     ', ' #######     ', '  ######     ', '  ######     ', ' ###  ###    ', '###    ###   '
    ],
    dinoRun: [
      '      ######', '     ########', '     ###     ', '     ######  ', '    ######## ', '   ########  ', '  ########   ', '  ######     ', ' ########    ', '########     ', '########     ', ' #######     ', '  ######     ', '  ######     ', ' ##    ####  ', '##      ##   '
    ],
    cactus: ['   ##   ', '  ####  ', '  ####  ', ' ###### ', ' ###### ', '   ##   ', '   ##   ', '  ####  ', '  ####  ', '  ####  ', '  ####  ', '  ####  '],
    cactusTall: ['    ##     ', '   ####    ', '   ####    ', ' ######    ', ' ###### ## ', '   ####### ', '   ####### ', '    ####   ', '    ####   ', '   #####   ', '  ######   ', '  ######   ', '  ######   '],
    bird: ['       ##  ', '      #### ', '  ## ######', ' ##########', '   ####### ', '    ##  ## ', '   ##      '],
    cloud: ['       ######', '    ##########', '  ####  ######', ' ################', '  ############  ']
  };

  let state = 'ready';
  let last = 0, distance = 0, score = 0, speed = 250, nextObstacle = 380, groundOffset = 0;
  let highScore = Number(localStorage.getItem('sacredDinoHighScore') || 0);
  let obstacles = [], particles = [], gap = null, nextMilestone = 0, milestoneTimer = 0;
  const dino = { x: 108, y: groundY - 48, w: 36, h: 48, vy: 0, onGround: true, frame: 0 };
  const clouds = [{ x: 130, y: 62 }, { x: 500, y: 92 }, { x: 790, y: 46 }];
  let audio;

  function sprite(map, x, y, scale = pixel, color = ink) {
    ctx.fillStyle = color;
    map.forEach((row, ry) => [...row].forEach((cell, rx) => { if (cell === '#') ctx.fillRect(Math.round(x + rx * scale), Math.round(y + ry * scale), scale, scale); }));
  }
  function spriteWidth(map) { return map[0].length * pixel; }

  function sound(kind) {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      const tones = { jump: [420, 620, .08], land: [130, 90, .07], trick: [180, 520, .16], hit: [110, 42, .26], win: [440, 880, .5] };
      const [from, to, duration] = tones[kind]; osc.type = kind === 'hit' ? 'sawtooth' : 'square'; osc.frequency.setValueAtTime(from, now); osc.frequency.exponentialRampToValueAtTime(to, now + duration); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(kind === 'hit' ? .12 : .055, now + .01); gain.gain.exponentialRampToValueAtTime(.0001, now + duration); osc.connect(gain).connect(audio.destination); osc.start(now); osc.stop(now + duration + .02);
    } catch (_) { /* Audio is optional in restricted browsers. */ }
  }

  function reset() {
    state = 'running'; last = performance.now(); distance = 0; score = 0; speed = 250; nextObstacle = 360; groundOffset = 0; obstacles = []; particles = []; gap = null; nextMilestone = 0; milestoneTimer = 0;
    Object.assign(dino, { y: groundY - 48, vy: 0, onGround: true, frame: 0 });
    messageEl.classList.add('is-hidden'); statusEl.textContent = 'RUNNING'; updateScore();
  }
  function startOrJump() { if (state === 'ready' || state === 'dead' || state === 'won') reset(); jump(); }
  function jump() { if (state !== 'running' || !dino.onGround) return; dino.vy = -690; dino.onGround = false; sound('jump'); }
  function updateScore() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('sacredDinoHighScore', String(highScore));
    }
    highScoreEl.textContent = String(highScore).padStart(5, '0');
    scoreEl.textContent = String(score).padStart(5, '0');
  }

  function addObstacle() {
    const birdAllowed = score >= 4 && Math.random() < .24;
    const tall = Math.random() > .72;
    const map = birdAllowed ? sprites.bird : (tall ? sprites.cactusTall : sprites.cactus);
    const h = map.length * pixel, w = spriteWidth(map);
    obstacles.push({ type: birdAllowed ? 'bird' : 'cactus', x: W + 20, y: birdAllowed ? groundY - 105 - Math.random() * 32 : groundY - h, w, h, map, seed: Math.random() * 10, passed: false });
    nextObstacle = 270 + Math.random() * (score >= 9 ? 110 : 280);
  }

  function milestone(scoreValue) {
    const names = { 2: 'SNEAKY GROUND // ACTIVE', 4: 'SKY SHIFT // ACTIVE', 6: 'VOID GAP // ACTIVE', 8: 'MULTI-TRICK // ACTIVE', 9: 'MAXIMUM DIFFICULTY' };
    if (!names[scoreValue]) return; milestoneEl.textContent = names[scoreValue]; milestoneEl.classList.add('show'); milestoneTimer = 1.8; sound('trick');
  }

  function update(dt) {
    if (state !== 'running') return;
    distance += speed * dt; groundOffset = (groundOffset + speed * dt) % 60;
    const newScore = Math.min(10, Math.floor(distance / 570));
    if (newScore !== score) { score = newScore; updateScore(); if (score >= nextMilestone) { nextMilestone = score + 1; milestone(score); } }
    if (score === 10) { state = 'won'; statusEl.textContent = 'CLEARED'; messageEl.classList.remove('is-hidden'); messageEl.querySelector('.message-kicker').textContent = 'RUN COMPLETE / 10 POINTS'; messageEl.querySelector('h1').textContent = 'VICTORY'; messageEl.querySelector('p').innerHTML = 'Press <kbd>R</kbd> or tap to run again'; sound('win'); burst(dino.x + 18, dino.y + 20); return; }
    speed = 250 + score * 12 + (score >= 9 ? 54 : 0);
    nextObstacle -= speed * dt; if (nextObstacle <= 0) addObstacle();
    dino.vy += 1900 * dt; dino.y += dino.vy * dt;
    if (dino.y >= groundY - dino.h) { if (!dino.onGround && dino.vy > 50) sound('land'); dino.y = groundY - dino.h; dino.vy = 0; dino.onGround = true; }
    dino.frame += dt * 11;
    obstacles.forEach(o => { o.x -= speed * dt; if (o.type === 'bird' && score >= 4) o.y += Math.sin(distance / 110 + o.seed) * 95 * dt; if (score >= 2 && o.type === 'cactus' && !dino.onGround && Math.abs(o.x - dino.x) < 100) o.y = groundY - o.h - Math.sin(Math.min(1, Math.abs(o.x - dino.x) / 100) * Math.PI) * 42; });
    obstacles = obstacles.filter(o => o.x > -80);
    if (score >= 6) { if (!gap && Math.random() < .004 * (score - 5)) gap = { x: W + 40, w: score >= 8 ? 82 : 58 }; if (gap) { gap.x -= speed * dt; if (gap.x < -gap.w) gap = null; } }
    if (gap && dino.x + dino.w > gap.x && dino.x < gap.x + gap.w && dino.y + dino.h >= groundY - 2 && dino.onGround) die();
    obstacles.forEach(o => { if (!o.passed && o.x + o.w < dino.x) o.passed = true; if (hitbox(dino.x + 6, dino.y + 5, dino.w - 10, dino.h - 7, o.x + 4, o.y + 4, o.w - 8, o.h - 7)) die(); });
    if (milestoneTimer > 0 && (milestoneTimer -= dt) <= 0) milestoneEl.classList.remove('show');
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt; }); particles = particles.filter(p => p.life > 0);
  }
  function hitbox(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }
  function die() { if (state !== 'running') return; state = 'dead'; statusEl.textContent = 'OFFLINE'; messageEl.classList.remove('is-hidden'); messageEl.querySelector('.message-kicker').textContent = 'RUN INTERRUPTED'; messageEl.querySelector('h1').textContent = 'GAME OVER'; messageEl.querySelector('p').innerHTML = 'Press <kbd>R</kbd> or tap to restart'; sound('hit'); burst(dino.x + 18, dino.y + 24); }
  function burst(x, y) { for (let i = 0; i < 18; i++) particles.push({ x, y, vx: (Math.random() - .5) * 150, vy: (Math.random() - .8) * 140, life: .6 + Math.random() * .5 }); }

  function draw() {
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, W, H);
    clouds.forEach((c, i) => { const x = ((c.x - distance * (.025 + i * .006)) % (W + 100) + W + 100) % (W + 100) - 40; sprite(sprites.cloud, x, c.y, 3, '#dededc'); });
    ctx.fillStyle = '#d3d3d1';
    if (!gap) ctx.fillRect(0, groundY, W, 2); else { ctx.fillRect(0, groundY, gap.x, 2); ctx.fillRect(gap.x + gap.w, groundY, W, 2); ctx.fillStyle = '#bcbcb9'; ctx.fillRect(gap.x + 10, groundY + 3, gap.w - 20, 1); }
    ctx.fillStyle = '#c9c9c7'; for (let x = -groundOffset; x < W; x += 60) { ctx.fillRect(x, groundY + 8, 2, 2); ctx.fillRect(x + 17, groundY + 5, 1, 1); ctx.fillRect(x + 36, groundY + 11, 3, 1); }
    obstacles.forEach(o => { if (o.type === 'bird') { const flap = Math.floor(distance / 80) % 2; sprite(o.map, o.x, o.y + (flap ? 2 : 0), 3); } else sprite(o.map, o.x, o.y, 3); });
    if (state !== 'dead') sprite(Math.floor(dino.frame) % 2 ? sprites.dinoRun : sprites.dino, dino.x, dino.y, 3); else sprite(sprites.dino, dino.x, dino.y, 3);
    particles.forEach(p => { ctx.fillStyle = ink; ctx.fillRect(p.x, p.y, 3, 3); });
  }

  function loop(now) { const dt = Math.min(.032, (now - last) / 1000 || 0); last = now; update(dt); draw(); requestAnimationFrame(loop); }
  function input(e) { if (e) e.preventDefault(); startOrJump(); }
  window.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'ArrowUp') input(e); if (e.code === 'KeyR') { reset(); } });
  canvas.addEventListener('pointerdown', input); messageEl.addEventListener('pointerdown', input);
  requestAnimationFrame(loop);
})();
