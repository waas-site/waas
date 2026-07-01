(function () {
  'use strict';

  const canvas = document.getElementById('dino-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width;   // 640
  const H = canvas.height;  // 360
  const S = 6;              // Standard scale for 24x24 grid

  const GY = Math.round(H * 0.74); // ground y

  /* ── Palette ─────────────────────────────────────── */
  const INK   = '#15191e'; // Black outline
  const CACT  = '#29d6a8'; // Mint green cactus

  /* ── Dino Image ──────────────────────────────────── */
  const dinoImg = new Image();
  dinoImg.src = 'assets/images/dino.png';

  // Display height doubled (was 144) so the dino renders 2x bigger.
  const DINO_DISPLAY_H = 288;
  let DINO_DISPLAY_W = 288;

  // Fraction of the raw image height that is empty space below the dino's
  // actual feet (transparent/padding pixels). Detected automatically once
  // the image loads so the sprite sits flush on the ground regardless of
  // how much padding the source PNG has. Defaults to 0 until measured.
  let footPaddingRatio = 0;

  function measureFootPadding(img) {
    try {
      const off = document.createElement('canvas');
      off.width = img.naturalWidth;
      off.height = img.naturalHeight;
      const octx = off.getContext('2d');
      octx.drawImage(img, 0, 0);
      const { data, width, height } = octx.getImageData(0, 0, off.width, off.height);

      // Scan from the bottom row upward to find the last row that contains
      // a visible (non-transparent) pixel — that row is where the feet are.
      let lastVisibleRow = height - 1;
      outer:
      for (let y = height - 1; y >= 0; y--) {
        const rowStart = y * width * 4;
        for (let x = 0; x < width; x++) {
          const alpha = data[rowStart + x * 4 + 3];
          if (alpha > 10) {
            lastVisibleRow = y;
            break outer;
          }
        }
      }
      return (height - 1 - lastVisibleRow) / height;
    } catch (e) {
      // Canvas may be tainted (e.g. running from file://) — fall back to
      // assuming no padding rather than breaking the game.
      return 0;
    }
  }

  function repositionDino() {
    // Visible bottom of the sprite, in display pixels, accounting for any
    // transparent padding below the feet in the source image.
    const visibleBottom = DINO_DISPLAY_H * (1 - footPaddingRatio);
    dino.baseY = GY - visibleBottom;
    dino.y = dino.baseY;
  }

  dinoImg.onload = () => {
    const aspect = dinoImg.width / dinoImg.height;
    DINO_DISPLAY_W = DINO_DISPLAY_H * aspect;
    footPaddingRatio = measureFootPadding(dinoImg);
    repositionDino();
  };

  /* ── Cactus pixel art (Hand-drawn) ───────────────── */
  const CACTUS_DATA = [
    [0,0,0,0,2,2,2,0,0,0,0],
    [0,0,0,2,1,1,1,2,0,0,0],
    [0,0,0,2,1,1,1,2,0,0,0],
    [0,0,0,2,1,1,1,2,0,0,0],
    [2,2,2,2,1,1,1,2,0,0,0],
    [2,1,1,2,1,1,1,2,2,2,2],
    [2,1,1,2,1,1,1,2,1,1,2],
    [2,1,1,2,1,1,1,2,1,1,2],
    [2,1,1,1,1,1,1,1,1,1,2],
    [0,2,2,2,1,1,1,2,2,2,2],
    [0,0,0,2,1,1,1,2,0,0,0],
    [0,0,0,2,1,1,1,2,0,0,0],
    [0,0,0,2,1,1,1,2,0,0,0],
    [0,0,0,2,1,1,1,2,0,0,0],
    [0,0,0,2,1,1,1,2,0,0,0],
    [0,0,0,2,2,2,2,2,0,0,0],
  ];

  const CPAL = { 1: CACT, 2: INK };

  function drawCactus(ox, oy, data) {
    for (let r = 0; r < data.length; r++) {
      for (let c = 0; c < data[r].length; c++) {
        const v = data[r][c];
        if (!v) continue;
        ctx.fillStyle = CPAL[v];
        ctx.fillRect(ox + c * S, oy + r * S, S, S);
      }
    }
  }

  /* ── Game state ──────────────────────────────────── */
  const GRAVITY    = 0.8;   
  const JUMP_VY    = -18;    
  const RUN_SPEED  = 6;      
  const REACT_DIST = 180; 

  const dino = {
    x:       70,
    baseY:   GY - DINO_DISPLAY_H,
    y:       GY - DINO_DISPLAY_H,
    vy:      0,
    jumping: false,
    jumpDelay: 0,
  };

  const cPool = [];
  let spawnT = 0;
  let spawnI = 100;
  let tick   = 0;

  function spawnCactus() {
    cPool.push({
      x:      W + 10,
      y:      GY - CACTUS_DATA.length * S,
      data:   CACTUS_DATA,
      w:      CACTUS_DATA[0].length * S,
      jumped: false,
    });
  }

  function autoJump() {
    if (dino.jumping) return;
    const rightEdge = dino.x + DINO_DISPLAY_W - 20; 
    for (const c of cPool) {
      if (c.jumped) continue;
      const dist = c.x - rightEdge;
      
      if (dist > 0 && dist < REACT_DIST && dino.jumpDelay === 0) {
        dino.jumpDelay = 25; 
      }
    }

    if (dino.jumpDelay > 0) {
      dino.jumpDelay--;
      if (dino.jumpDelay === 0) {
        dino.vy      = JUMP_VY;
        dino.jumping = true;
        for (const c of cPool) {
          if (c.x - (dino.x + DINO_DISPLAY_W) < REACT_DIST + 100) c.jumped = true;
        }
      }
    }
  }

  /* ── Update ──────────────────────────────────────── */
  function update() {
    tick++;
    autoJump();

    dino.y  += dino.vy;
    dino.vy += GRAVITY;
    if (dino.y >= dino.baseY) {
      dino.y       = dino.baseY;
      dino.vy      = 0;
      dino.jumping = false;
    }

    if (++spawnT >= spawnI) {
      spawnCactus();
      spawnT = 0;
      spawnI = 100 + Math.random() * 100;
    }
    for (let i = cPool.length - 1; i >= 0; i--) {
      cPool[i].x -= RUN_SPEED;
      if (cPool[i].x + cPool[i].w < 0) cPool.splice(i, 1);
    }
  }

  /* ── Render ──────────────────────────────────────── */
  function render() {
    ctx.clearRect(0, 0, W, H);

    // Ground line
    ctx.fillStyle = INK;
    ctx.fillRect(0, GY, W, 4);

    // Dashes
    ctx.fillStyle = INK;
    const off = (tick * RUN_SPEED) % 40;
    for (let x = -off; x < W; x += 60) {
      ctx.fillRect(x, GY + 10, 15, 3);
      ctx.fillRect(x + 30, GY + 18, 8, 3);
    }

    // Cacti
    cPool.forEach(c => drawCactus(c.x, c.y, c.data));

    // Dino
    if (dinoImg.complete) {
      // Draw the image as provided (including black background)
      ctx.drawImage(dinoImg, dino.x, Math.round(dino.y), DINO_DISPLAY_W, DINO_DISPLAY_H);
    }
  }

  (function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  })();

})();
