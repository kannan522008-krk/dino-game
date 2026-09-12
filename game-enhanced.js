(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const messageEl = document.getElementById('message');
  const milestoneEl = document.getElementById('milestone');
  const warningEl = document.getElementById('warning');
  const glitchEl = document.getElementById('glitchOverlay');
  const blankEl = document.getElementById('blankOverlay');
  const speedReadoutEl = document.getElementById('speedReadout');
  const timerEl = document.getElementById('timer');
  const messageTextEl = document.getElementById('messageText');
  const messageDetailEl = document.getElementById('messageDetail');
  const statusEl = document.getElementById('statusText');
  const ink = '#535353', orange = '#d8752c';
  const W = canvas.width, H = canvas.height, groundY = 246, pixel = 3;
  const sprites = {
    dino: ['        ####### ', '       #########', '       ### #### ', '       #########', '       ##########', '        ######## ', '        #######  ', '        ###      ', '   #######       ', '  ##########     ', ' ###########     ', '###########      ', '#######          ', '  #######        ', '   ######        ', '   ###  ###       '],
    dinoRun: ['        ####### ', '       #########', '       ### #### ', '       #########', '       ##########', '        ######## ', '        #######  ', '        ###      ', '   #######       ', '  ##########     ', ' ###########     ', '###########      ', '#######          ', '  #######        ', ' ##      ####    ', '##        ##     '],
    dinoFall: ['        ####### ', '       #########', '       ### #### ', '       #########', '       ##########', '        ######## ', '        #######  ', '        ###      ', '   #######       ', '  ##########     ', ' ###########     ', '###########      ', '#######          ', '  #######        ', '  ###   ###      ', '  ##     ##      '],
    cactus: ['   ##   ', '  ####  ', '  ####  ', ' ###### ', ' ###### ', '   ##   ', '   ##   ', '  ####  ', '  ####  ', '  ####  ', '  ####  ', '  ####  '],
    cactusTall: ['    ##     ', '   ####    ', '   ####    ', ' ######    ', ' ###### ## ', '   ####### ', '   ####### ', '    ####   ', '    ####   ', '   #####   ', '  ######   ', '  ######   ', '  ######   '],
    birdA: ['       ##  ', '      #### ', '  ## ######', ' ##########', '   ####### ', '    ##  ## ', '   ##      '],
    birdB: ['       ##  ', '      #### ', '  ## ######', ' ##########', '   ####### ', '   ##  ##  ', '  ##       '],
    cloud: ['       ######', '    ##########', '  ####  ######', ' ################', '  ############  '],
    fireballA: [' ## ', '####', ' ## '], fireballB: ['  # ', '####', ' ## '], crack: ['##  ##  ##', '  ######  ', '    ##    ']
  };
  let state = 'ready', last = 0, distance = 0, score = 0, speed = 250, nextObstacle = 360, groundOffset = 0;
  let attemptStartedAt = 0, elapsedMs = 0, victoryShown = false, deathReason = 'death';
  let obstacles = [], fireballs = [], particles = [], voidTrap = null, nextMilestone = 0, milestoneTimer = 0, deathTimer = 0, speedBoostTimer = 0, crackTimer = 0;
  let speedBoostLevel = 0, warningTimer = 0, warningCooldown = 0, glitchTimer = 0, glitchCooldown = 7, blankWarningTimer = 0, blankTimer = 0, blankCooldown = 12, shakeTimer = 0, lastNearMiss = 0, underCactusCooldown = 0;
  let firefall = [], firefallCooldown = 5, blackoutCactus = null, specialBlackoutArmed = false;
  const dino = { x: 108, y: groundY - 48, w: 48, h: 48, vy: 0, onGround: true, frame: 0, fallFrame: 0 };
  const clouds = [{ x: 130, y: 62 }, { x: 500, y: 92 }, { x: 790, y: 46 }];
  let audio;

  function sprite(map, x, y, scale = pixel, color = ink) { ctx.fillStyle = color; map.forEach((row, ry) => [...row].forEach((cell, rx) => { if (cell === '#') ctx.fillRect(Math.round(x + rx * scale), Math.round(y + ry * scale), scale, scale); })); }
  function widthOf(map) { return map[0].length * pixel; }
  function sound(kind) {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume();
      const tones = { jump: [420, 620, .08], land: [130, 90, .07], cactus: [180, 430, .12], bird: [350, 180, .12], fireball: [210, 680, .1], void: [160, 55, .24], fall: [120, 45, .35], death: [110, 42, .26], trick: [180, 520, .16], speed: [260, 740, .14], warning: [680, 250, .12], glitch: [90, 740, .42], close: [320, 220, .08], win: [440, 880, .5] };
      const [from, to, duration] = tones[kind] || tones.trick, now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = kind === 'death' || kind === 'void' ? 'sawtooth' : 'square'; osc.frequency.setValueAtTime(from, now); osc.frequency.exponentialRampToValueAtTime(to, now + duration); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(kind === 'death' ? .12 : .055, now + .01); gain.gain.exponentialRampToValueAtTime(.0001, now + duration); osc.connect(gain).connect(audio.destination); osc.start(now); osc.stop(now + duration + .02);
    } catch (_) { }
  }
  function reset() { state = 'running'; last = performance.now(); attemptStartedAt = last; elapsedMs = 0; distance = 0; score = 0; speed = 250; nextObstacle = 360; groundOffset = 0; obstacles = []; fireballs = []; firefall = []; particles = []; voidTrap = null; blackoutCactus = null; specialBlackoutArmed = false; underCactusCooldown = 0; nextMilestone = 0; milestoneTimer = 0; deathTimer = 0; deathReason = 'death'; speedBoostTimer = 0; speedBoostLevel = 0; crackTimer = 0; warningTimer = 0; warningCooldown = 0; glitchTimer = 0; glitchCooldown = 7; blankWarningTimer = 0; blankTimer = 0; blankCooldown = 12; firefallCooldown = 5; victoryShown = false; Object.assign(dino, { y: groundY - 48, vy: 0, onGround: true, frame: 0, fallFrame: 0, tilt: 0 }); messageTextEl.innerHTML = 'Press <kbd>SPACE</kbd> or <kbd>UP</kbd> to begin'; messageDetailEl.textContent = 'Keep going forever'; warningEl.classList.remove('show'); glitchEl.classList.remove('show'); blankEl.classList.remove('show', 'warning-state'); messageEl.classList.add('is-hidden'); statusEl.textContent = 'RUNNING'; updateScore(); updateTimer(); }
  function startOrJump() { if (state === 'ready' || state === 'dead' || state === 'won') reset(); jump(); }
  function jump() { if (state !== 'running' || !dino.onGround) return; dino.vy = -690; dino.onGround = false; sound('jump'); }
  function updateScore() { scoreEl.textContent = String(score).padStart(5, '0'); }
  function currentElapsed() { return state === 'running' || state === 'dying' || state === 'falling' ? performance.now() - attemptStartedAt : elapsedMs; }
  function formatTime(ms) { const seconds = ms / 1000; const minutes = Math.floor(seconds / 60); return `TIME: ${String(minutes).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`; }
  function updateTimer() { elapsedMs = currentElapsed(); timerEl.textContent = formatTime(elapsedMs); speedReadoutEl.textContent = `SPEED: ${(speed / 250).toFixed(1)}x`; }
  function warn(text, duration = .7) { if (warningCooldown > 0) return; warningEl.textContent = text; warningEl.classList.add('show'); warningTimer = duration; warningCooldown = .55; sound('warning'); }
  function startGlitch() { if (glitchTimer > 0 || score < 8 || dino.onGround) return; glitchTimer = 2; glitchCooldown = 10 + Math.random() * 8; scoreEl.textContent = `??${String(score).slice(-2)}?`; glitchEl.classList.add('show'); sound('glitch'); }
  function startBlank(force = false) { if (glitchTimer > 0 || blankTimer > 0 || blankWarningTimer > 0 || specialBlackoutArmed || (!force && blankCooldown > 0) || (!force && score < 8)) return; blankWarningTimer = .45; blankCooldown = 12 + Math.random() * 8; warningEl.textContent = "SOMETHING'S COMING..."; warningEl.classList.add('show'); warningTimer = .45; warningCooldown = .55; blankEl.classList.add('show', 'warning-state'); sound('warning'); }
  function revealBlackoutCactus() { if (specialBlackoutArmed) return; addCactus({ x: dino.x + 125 + Math.random() * 30 }); blackoutCactus = obstacles[obstacles.length - 1]; blackoutCactus.specialBlackout = true; specialBlackoutArmed = true; sound('trick'); }
  function launchFirefall() { const count = Math.min(1 + Math.floor(score / 18), 5); for (let i = 0; i < count; i++) firefall.push({ x: 170 + Math.random() * 650, y: -18 - Math.random() * 54, vy: 120 + score * 2 + Math.random() * 90, w: 12, h: 15, frame: Math.random() * 10 }); sound('fireball'); warn("SOMETHING'S COMING...", .5); }
  function funnyMessage(seconds) { const choices = ['Stop wasting your time and go do something productive. LOL', 'Congratulations. You accomplished absolutely nothing.', 'Your productivity called. It wants you back.', `That was ${seconds.toFixed(2)} seconds you will never get back.`, 'You could have been doing something productive.', 'Bro... seriously?', 'The Dino is disappointed in your life choices.', 'Patience tested. Productivity destroyed.', 'Excellent reflexes. Terrible time management.']; return choices[Math.floor(Math.random() * choices.length)]; }
  function addCactus(options = {}) { const map = options.tall ? sprites.cactusTall : sprites.cactus, h = map.length * pixel, w = widthOf(map); obstacles.push({ type: 'cactus', x: options.x ?? W + 20, y: groundY - h, baseY: groundY - h, w, h, map, passed: false, hidden: !!options.hidden, emerge: options.hidden ? 0 : 1, fake: !!options.fake, fakeTimer: options.fake ? .72 : 0, under: !!options.under, underUsed: false, nearChecked: false, warningSent: false }); }
  function addBird() { const map = Math.random() > .5 ? sprites.birdA : sprites.birdB; obstacles.push({ type: 'bird', x: W + 20, y: groundY - 104 - Math.random() * 35, baseY: groundY - 104, w: widthOf(map), h: map.length * pixel, map, seed: Math.random() * 10, passed: false, dive: false, diveTimer: .8 + Math.random() * .8, fired: false, target: true, nearChecked: false, warningSent: false }); }
  function addObstacle() {
    const roll = Math.random();
    const chaos = score >= 60 ? 3.2 : score >= 50 ? 2.8 : score >= 40 ? 2.3 : score >= 30 ? 1.8 : score >= 20 ? 1.4 : score >= 10 ? 1.2 : 1;
    const trackingChance = score < 6 ? .08 : score < 10 ? .14 : score < 30 ? .18 : score < 60 ? .22 : .26;
    const trackingCactus = score >= 2 && underCactusCooldown <= 0 && Math.random() < trackingChance;
    if (trackingCactus) underCactusCooldown = Math.max(1.8, 4 - score * .012);
    if (score >= 4 && roll < (score >= 20 ? .18 : .08) * chaos) addBird();
    else if (score >= 8 && roll < .34 * chaos) { addCactus({ x: W + 20, under: trackingCactus }); addCactus({ x: W + 92, tall: Math.random() > .5, hidden: true }); }
    else addCactus({ tall: Math.random() > .72, hidden: score >= 3 && roll < .5, fake: score >= 7 && roll > .78, under: trackingCactus });
    if (score >= 10 && Math.random() < Math.min(.55, .18 + score * .004)) addBird();
    if (score >= 20 && Math.random() < Math.min(.5, .12 + score * .003)) addCactus({ x: W + 150, tall: true, hidden: score >= 30 && Math.random() < .45 });
    nextObstacle = Math.max(78, 300 - score * 3) + Math.random() * Math.max(45, 210 - score * 2);
  }
  function milestone(scoreValue) { const names = { 6: 'CHAOS MODE // ACTIVE', 10: 'FULL CHAOS MODE // ACTIVE', 20: 'INTERACTIVE BIRDS // ACTIVE', 30: 'RIDICULOUS COMBINATIONS // ACTIVE', 40: 'PATIENCE DESTROYER MODE', 50: 'EXTREME CHAOS', 60: 'IMPOSSIBLE MODE // NO MERCY' }; if (!names[scoreValue]) return; milestoneEl.textContent = names[scoreValue]; milestoneEl.classList.add('show'); milestoneTimer = scoreValue >= 40 ? 3.2 : 2.4; sound(scoreValue >= 40 ? 'speed' : 'trick'); }
  function supportAt(x) { return !voidTrap || x < voidTrap.x || x > voidTrap.x + voidTrap.w; }
  function openVoid(at = null) { if (voidTrap) return; voidTrap = { x: at ?? W + 80 + Math.random() * 240, w: score >= 8 ? 86 : 62, life: 6 }; sound('void'); }
  function maybeTricks() {
    if (score >= 6 && !voidTrap && Math.random() < .0035 * Math.max(1, score - 5)) openVoid();
    if (score >= 6 && !crackTimer && Math.random() < .002 + score * .00008) { crackTimer = 1.3; sound('trick'); }
    if (score >= 5 && !speedBoostTimer && Math.random() < .0012 + score * .00004) { speedBoostTimer = score >= 40 ? 3.6 : 2.8; speedBoostLevel += 35; sound('speed'); milestoneEl.textContent = 'SPEED SPIKE // DANGER'; milestoneEl.classList.add('show'); milestoneTimer = 1.2; }
    if (score >= 8 && dino.vy < -80 && glitchCooldown <= 0 && Math.random() < .002 + Math.min(.006, score * .00004)) startGlitch();
    if (score >= 6 && firefallCooldown <= 0) { launchFirefall(); firefallCooldown = Math.max(.7, 5.5 - score * .06); }
    if (score >= 8 && blankCooldown <= 0 && Math.random() < Math.min(.006, .0008 + score * .00007)) startBlank();
    if (score >= 40 && Math.random() < .0018) { sound('void'); milestoneEl.textContent = score >= 60 ? 'IMPOSSIBLE MODE // NO MERCY' : 'PATIENCE DESTROYER MODE'; milestoneEl.classList.add('show'); milestoneTimer = 1.4; }
  }

  function update(dt) {
    if (state === 'won' || state === 'ready') return; if (state === 'dying' || state === 'falling') { updateDeath(dt); return; } if (state !== 'running') return;
    if (glitchTimer > 0) { glitchTimer = Math.max(0, glitchTimer - dt); if (glitchTimer === 0) { glitchEl.classList.remove('show'); updateScore(); } return; }
    if (blankWarningTimer > 0) { blankWarningTimer = Math.max(0, blankWarningTimer - dt); if (blankWarningTimer === 0) { blankTimer = 2; blankEl.classList.remove('warning-state'); blankEl.classList.add('show'); sound('glitch'); } return; }
    if (blankTimer > 0) { blankTimer = Math.max(0, blankTimer - dt); if (blankTimer === 0) { blankEl.classList.remove('show'); revealBlackoutCactus(); } return; }
    glitchCooldown -= dt; blankCooldown -= dt; firefallCooldown -= dt; underCactusCooldown = Math.max(0, underCactusCooldown - dt); warningCooldown = Math.max(0, warningCooldown - dt); if (warningTimer > 0 && (warningTimer -= dt) <= 0) warningEl.classList.remove('show'); shakeTimer = Math.max(0, shakeTimer - dt);
    elapsedMs = performance.now() - attemptStartedAt; updateTimer();
    distance += speed * dt; groundOffset = (groundOffset + speed * dt) % 60; const newScore = Math.floor(distance / 570);
    if (newScore !== score) { score = newScore; updateScore(); if (score >= nextMilestone) { nextMilestone = score + 1; milestone(score); } }
    speed = Math.max(speed, difficultySpeed() + speedBoostLevel + (speedBoostTimer > 0 ? 125 : 0)); speedBoostTimer = Math.max(0, speedBoostTimer - dt); nextObstacle -= speed * dt; if (nextObstacle <= 0) addObstacle(); maybeTricks();
    if (voidTrap) { voidTrap.x -= speed * dt; voidTrap.life -= dt; if (voidTrap.x < -voidTrap.w || voidTrap.life <= 0) voidTrap = null; } if (crackTimer > 0) crackTimer -= dt;
    dino.vy += 1900 * dt; dino.y += dino.vy * dt; dino.frame += dt * 11; const feetX = dino.x + dino.w / 2;
    if (dino.y >= groundY - dino.h && supportAt(feetX)) { if (!dino.onGround && dino.vy > 50) sound('land'); dino.y = groundY - dino.h; dino.vy = 0; dino.onGround = true; } else if (dino.y + dino.h >= groundY && !supportAt(feetX)) { if (dino.onGround) { dino.onGround = false; sound('fall'); state = 'falling'; deathTimer = .55; } }
    obstacles.forEach(o => updateObstacle(o, dt)); obstacles = obstacles.filter(o => o.x > -100 && (!o.fake || o.fakeTimer > 0)); fireballs.forEach(f => { f.x -= (speed + 75) * dt; f.frame += dt * 15; }); fireballs = fireballs.filter(f => f.x > -30);
    firefall.forEach(f => { f.y += f.vy * dt; f.vy += 280 * dt; f.frame += dt * 15; }); firefall = firefall.filter(f => f.y < groundY + 30);
    if (voidTrap && dino.x + dino.w > voidTrap.x && dino.x < voidTrap.x + voidTrap.w && dino.y + dino.h >= groundY - 3 && !dino.onGround) { state = 'falling'; deathTimer = .55; sound('fall'); }
    obstacles.forEach(o => { if (!o.passed && o.x + o.w < dino.x) { o.passed = true; if (!o.nearChecked && Math.abs(o.x + o.w - dino.x) < 28 && Math.abs((dino.y + dino.h / 2) - (o.y + o.h / 2)) < 58) { o.nearChecked = true; shakeTimer = .16; warn(Math.random() > .5 ? 'CLOSE!' : 'TOO CLOSE!', .45); sound('close'); } } if (!o.fake && collision(dino.x + 7, dino.y + 6, dino.w - 13, dino.h - 9, o.x + 4, o.y + 4, o.w - 8, o.h - 7)) die('death'); }); fireballs.forEach(f => { if (collision(dino.x + 8, dino.y + 7, dino.w - 15, dino.h - 10, f.x, f.y, f.w, f.h)) die('fireball'); }); firefall.forEach(f => { if (collision(dino.x + 8, dino.y + 7, dino.w - 15, dino.h - 10, f.x, f.y, f.w, f.h)) die('fireball'); });
    checkBlackoutPass();
    if (milestoneTimer > 0 && (milestoneTimer -= dt) <= 0) milestoneEl.classList.remove('show'); particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt; }); particles = particles.filter(p => p.life > 0);
  }
  function difficultySpeed() { return Math.min(1000, 250 + score * 4.5 + score * score * .02); }
  function updateObstacle(o, dt) {
    o.x -= speed * dt;
    if (o.type === 'cactus') {
      if (o.hidden && o.x < dino.x + 230 && !o.warningSent) { o.warningSent = true; warn("SOMETHING'S COMING...", Math.max(.35, .8 - score * .006)); }
      if (o.fake) { o.fakeTimer -= dt; }
      if (o.emerge < 1) {
        if (o.x < dino.x + 230) {
          o.emerge = Math.min(1, o.emerge + dt * (score >= 40 ? 3.8 : 3.1));
          if (o.emerge > .08 && !o.emergeSounded) { o.emergeSounded = true; sound('cactus'); }
        }
        o.y = o.baseY + o.h * (1 - o.emerge);
      }
      if (o.under && !o.underUsed && !dino.onGround && Math.abs(o.x - dino.x) < 150) { o.underUsed = true; o.trackTarget = dino.x + Math.max(18, -dino.vy * .08); sound('trick'); }
      if (o.trackTarget) o.x += (o.trackTarget - o.x) * Math.min(1, dt * 2.4);
    } else {
      if (o.x < dino.x + 260 && !o.warningSent && score >= 4) { o.warningSent = true; warn("SOMETHING'S COMING...", .5); }
      const targetY = dino.y + dino.h * .35;
      o.y += (targetY - o.y) * dt * (o.target ? .55 : .2);
      o.y += Math.sin(distance / 115 + o.seed) * 35 * dt;
      o.diveTimer -= dt;
      if (o.diveTimer <= 0 && !o.dive) { o.dive = true; o.diveTimer = .7; sound('bird'); }
      if (o.dive) { o.y += 125 * dt; if (o.y > groundY - 64) { o.dive = false; o.diveTimer = 1.1 + Math.random(); } }
      if (score >= 4 && !o.fired && o.x < W - 120 && Math.random() < dt * (.18 + Math.min(.7, score / 90))) { o.fired = true; fireballs.push({ x: o.x - 2, y: o.y + 18, w: 12, h: 9, frame: 0 }); sound('fireball'); }
    }
  }
  function updateDeath(dt) { elapsedMs = currentElapsed(); updateTimer(); dino.vy += state === 'falling' ? 2100 * dt : 1000 * dt; dino.y += dino.vy * dt; dino.tilt = Math.min(.22, dino.tilt + dt * .8); dino.fallFrame += dt * 14; deathTimer -= dt; if (deathTimer <= 0) { elapsedMs = currentElapsed(); updateTimer(); state = 'dead'; statusEl.textContent = 'OFFLINE'; messageEl.classList.remove('is-hidden'); const seconds = elapsedMs / 1000; messageEl.querySelector('.message-kicker').textContent = 'RUN INTERRUPTED / TIME WASTED'; messageEl.querySelector('h1').textContent = 'GAME OVER!'; if (deathReason === 'special-blackout') { messageTextEl.textContent = 'okay you passed, but failed! You gained nothing!'; messageDetailEl.textContent = `SCORE: ${score}  //  TIME WASTED: ${seconds.toFixed(2)} seconds`; } else { messageTextEl.textContent = `You've successfully wasted ${seconds.toFixed(2)} seconds of your life LOL`; messageDetailEl.textContent = `SCORE: ${score}  //  TIME WASTED: ${seconds.toFixed(2)} seconds  //  ${funnyMessage(seconds)}`; } sound('death'); burst(dino.x + 18, Math.min(dino.y + 24, groundY)); } }
  function checkBlackoutPass() { if (specialBlackoutArmed && blackoutCactus && blackoutCactus.x + blackoutCactus.w < dino.x) { specialBlackoutArmed = false; blackoutCactus = null; die('special-blackout'); } }
  function collision(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }
  function die(reason) { if (state !== 'running') return; deathReason = reason; state = 'dying'; deathTimer = .42; dino.vy = -235; dino.tilt = 0; sound(reason); }
  function burst(x, y) { for (let i = 0; i < 18; i++) particles.push({ x, y, vx: (Math.random() - .5) * 150, vy: (Math.random() - .8) * 140, life: .6 + Math.random() * .5 }); }
  function draw() { ctx.save(); if (shakeTimer > 0) ctx.translate((Math.random() - .5) * 5, (Math.random() - .5) * 3); ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, W, H); clouds.forEach((c, i) => { const x = ((c.x - distance * (.025 + i * .006)) % (W + 100) + W + 100) % (W + 100) - 40; sprite(sprites.cloud, x, c.y, 3, '#dededc'); }); ctx.fillStyle = '#d3d3d1'; if (!voidTrap) ctx.fillRect(0, groundY, W, 2); else { ctx.fillRect(0, groundY, voidTrap.x, 2); ctx.fillRect(voidTrap.x + voidTrap.w, groundY, W, 2); ctx.fillStyle = '#bcbcb9'; ctx.fillRect(voidTrap.x + 10, groundY + 3, voidTrap.w - 20, 1); } ctx.fillStyle = '#c9c9c7'; for (let x = -groundOffset; x < W; x += 60) { ctx.fillRect(x, groundY + 8, 2, 2); ctx.fillRect(x + 17, groundY + 5, 1, 1); ctx.fillRect(x + 36, groundY + 11, 3, 1); } if (crackTimer > 0) sprite(sprites.crack, dino.x + 46, groundY - 2, 2, '#9a9a98'); if (voidTrap) { ctx.fillStyle = '#858583'; ctx.fillRect(voidTrap.x + 8, groundY + 2, 2, 5); ctx.fillRect(voidTrap.x + voidTrap.w - 10, groundY + 2, 2, 7); } obstacles.forEach(o => { if (o.fake && o.fakeTimer <= 0) return; if (o.type === 'bird') sprite((Math.floor(distance / 80) % 2) ? sprites.birdA : sprites.birdB, o.x, o.y, 3); else { if (o.fake) ctx.globalAlpha = .5; sprite(o.map, o.x, o.y, 3); ctx.globalAlpha = 1; } }); fireballs.forEach(f => sprite((Math.floor(f.frame) % 2) ? sprites.fireballA : sprites.fireballB, f.x, f.y, 3, orange)); firefall.forEach(f => { sprite((Math.floor(f.frame) % 2) ? sprites.fireballA : sprites.fireballB, f.x, f.y, 3, orange); ctx.fillStyle = orange; ctx.fillRect(f.x + 3, f.y - 5, 3, 5); }); const dinoMap = state === 'falling' || state === 'dying' ? sprites.dinoFall : (Math.floor(dino.frame) % 2 ? sprites.dinoRun : sprites.dino); if (dino.y < H + 20) { ctx.save(); ctx.translate(dino.x + 18, dino.y + 24); ctx.rotate(dino.tilt || 0); sprite(dinoMap, -18, -24, 3); ctx.restore(); } particles.forEach(p => { ctx.fillStyle = ink; ctx.fillRect(p.x, p.y, 3, 3); }); if (glitchTimer > 0) { ctx.globalAlpha = .35; ctx.fillStyle = '#d33'; ctx.fillRect(0, 72 + Math.random() * 110, W, 2); ctx.fillStyle = '#36a'; ctx.fillRect(Math.random() * 25, 150 + Math.random() * 70, W - 40, 1); ctx.globalAlpha = .22; for (let y = 0; y < H; y += 7) ctx.fillRect(Math.random() * 8, y, W, 1); ctx.globalAlpha = 1; } ctx.restore(); }
  function loop(now) { const dt = Math.min(.032, (now - last) / 1000 || 0); last = now; update(dt); draw(); requestAnimationFrame(loop); }
  function input(e) { if (e) e.preventDefault(); startOrJump(); }
  window.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'ArrowUp') input(e); if (e.code === 'KeyR') reset(); }); canvas.addEventListener('pointerdown', input); messageEl.addEventListener('pointerdown', input);
  window.__dinoDebug = { setScore(value) { distance = Math.max(0, value * 570); score = value; updateScore(); }, openVoid, addCactus, addBird, addFireball(x = dino.x + 30, y = dino.y + 18) { fireballs.push({ x, y, w: 12, h: 9, frame: 0 }); }, launchFirefall, clearObstacles() { obstacles = []; }, jump, startGlitch, startBlank: () => startBlank(true), getState: () => ({ state, score, speed, glitchTimer, glitchCooldown, blankWarningTimer, blankTimer, warning: warningEl.textContent, warningVisible: warningEl.classList.contains('show'), dino: { y: dino.y, vy: dino.vy, onGround: dino.onGround }, voidTrap, obstacles, fireballs, firefall }) };
  requestAnimationFrame(loop);
})();
