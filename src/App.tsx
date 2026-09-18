import { useEffect, useRef, useCallback } from 'react';

/**
 * Hero Runner - HTML5 Canvas Game (Enhanced Edition)
 * 
 * Features:
 * - Blue circle hero with gravity & jump (Space/Click)
 * - Red obstacles: hero grows +15%, screen shake, invincibility frames
 * - Green shrinkers: hero shrinks -20%, +5 score
 * - Yellow coins: +10 score with floating text
 * - Game Over when radius >= 120px
 * - Fast difficulty scaling (speed +4% every 3s, obstacles ramp up)
 * - Pause system (P/Esc)
 * - Local high score (localStorage)
 * - Survival timer, screen shake, speed-up indicator
 */

// ==================== CONSTANTS ====================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_Y = CANVAS_HEIGHT - 50;
const INITIAL_RADIUS = 30;
const HERO_X = 100;
const GRAVITY = 0.6;
const JUMP_FORCE = -13;
const BASE_SCROLL_SPEED = 3;
const LINE_SPACING = 80;
const MAX_RADIUS = 120;
const HITBOX_SHRINK = 0.9;
const SPEED_CAP_MULTIPLIER = 3; // Max 3x starting speed
const INVINCIBILITY_DURATION = 30; // 0.5 seconds at 60fps
const SCREEN_SHAKE_DURATION = 12; // 0.2 seconds at 60fps
const SPEED_UP_DISPLAY = 60; // 1 second at 60fps
const HIGH_SCORE_KEY = 'heroRunnerHighScore';

// ==================== TYPES ====================
interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'short' | 'tall';
}

interface Coin {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

interface Shrinker {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  velocityY: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
}

interface GameState {
  // Hero
  heroY: number;
  velocityY: number;
  isGrounded: boolean;
  heroRadius: number;
  maxRadiusReached: number;

  // Scrolling
  scrollOffset: number;
  scrollSpeed: number;
  baseSpeed: number;

  // Entities
  obstacles: Obstacle[];
  coins: Coin[];
  shrinkers: Shrinker[];
  floatingTexts: FloatingText[];
  particles: Particle[];

  // Score
  score: number;
  highScore: number;
  isNewRecord: boolean;

  // Timers (in frames)
  obstacleTimer: number;
  obstacleInterval: number;
  coinTimer: number;
  coinInterval: number;
  shrinkerTimer: number;
  shrinkerInterval: number;

  // Difficulty scaling
  speedTimer: number;
  spawnRateTimer: number;
  minObstacleInterval: number;

  // Visual effects
  flashTimer: number;
  squishTimer: number;
  squishScaleX: number;
  squishScaleY: number;
  screenShakeTimer: number;
  screenShakeX: number;
  screenShakeY: number;
  speedUpTimer: number;

  // Invincibility
  invincibilityTimer: number;

  // Survival timer
  survivalTime: number; // in frames

  // Pause
  isPaused: boolean;

  // Game state
  isGameOver: boolean;
  frameCount: number;
}

// ==================== HELPER FUNCTIONS ====================

function createInitialState(): GameState {
  const highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);

  return {
    heroY: GROUND_Y - INITIAL_RADIUS,
    velocityY: 0,
    isGrounded: true,
    heroRadius: INITIAL_RADIUS,
    maxRadiusReached: INITIAL_RADIUS,

    scrollOffset: 0,
    scrollSpeed: BASE_SCROLL_SPEED,
    baseSpeed: BASE_SCROLL_SPEED,

    obstacles: [],
    coins: [],
    shrinkers: [],
    floatingTexts: [],
    particles: [],

    score: 0,
    highScore: highScore,
    isNewRecord: false,

    obstacleTimer: 0,
    obstacleInterval: randomRange(90, 150), // 1.5-2.5 seconds
    coinTimer: 0,
    coinInterval: randomRange(45, 90),
    shrinkerTimer: 0,
    shrinkerInterval: randomRange(480, 720), // 8-12 seconds

    speedTimer: 0,
    spawnRateTimer: 0,
    minObstacleInterval: 90, // 1.5 seconds minimum

    flashTimer: 0,
    squishTimer: 0,
    squishScaleX: 1,
    squishScaleY: 1,
    screenShakeTimer: 0,
    screenShakeX: 0,
    screenShakeY: 0,
    speedUpTimer: 0,

    invincibilityTimer: 0,

    survivalTime: 0,

    isPaused: false,
    isGameOver: false,
    frameCount: 0,
  };
}

function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function circleRectCollision(
  cx: number, cy: number, cr: number,
  rx: number, ry: number, rw: number, rh: number
): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) < (cr * cr);
}

function circleCircleCollision(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (r1 + r2);
}

function formatTime(frames: number): string {
  const totalSeconds = Math.floor(frames / 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ==================== SPAWN FUNCTIONS ====================

function spawnObstacle(state: GameState): void {
  const isTall = Math.random() > 0.5;
  const height = isTall ? randomRange(60, 100) : randomRange(30, 50);
  const width = randomRange(25, 40);

  state.obstacles.push({
    x: CANVAS_WIDTH + 20,
    y: GROUND_Y - height,
    width: width,
    height: height,
    type: isTall ? 'tall' : 'short',
  });
}

function spawnCoin(state: GameState): void {
  const isAirborne = Math.random() > 0.4;
  const y = isAirborne
    ? randomRange(GROUND_Y - 150, GROUND_Y - 80)
    : GROUND_Y - 20;

  state.coins.push({
    x: CANVAS_WIDTH + 20,
    y: y,
    radius: 12,
    collected: false,
  });
}

function spawnShrinker(state: GameState): void {
  const y = randomRange(GROUND_Y - 180, GROUND_Y - 60);

  state.shrinkers.push({
    x: CANVAS_WIDTH + 20,
    y: y,
    radius: 15,
    collected: false,
  });
}

function addFloatingText(state: GameState, x: number, y: number, text: string, color: string): void {
  state.floatingTexts.push({
    x, y, text, color,
    alpha: 1.0,
    velocityY: -2,
  });
}

function addParticles(state: GameState, x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const speed = randomRange(2, 5);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: randomRange(2, 5),
      color: color,
      alpha: 1.0,
      life: randomRange(20, 40),
    });
  }
}

// ==================== COLLISION DETECTION ====================

function checkCollisions(state: GameState): void {
  const heroR = state.heroRadius * HITBOX_SHRINK;

  // Obstacle collisions (only if not invincible)
  if (state.invincibilityTimer <= 0) {
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obs = state.obstacles[i];
      if (circleRectCollision(
        HERO_X, state.heroY, heroR,
        obs.x, obs.y, obs.width, obs.height
      )) {
        // Hero grows 15%
        state.heroRadius *= 1.15;
        if (state.heroRadius > state.maxRadiusReached) {
          state.maxRadiusReached = state.heroRadius;
        }

        // Visual effects
        state.flashTimer = 15;
        state.squishTimer = 12;

        // Screen shake
        state.screenShakeTimer = SCREEN_SHAKE_DURATION;

        // Invincibility frames
        state.invincibilityTimer = INVINCIBILITY_DURATION;

        // Particles
        addParticles(state, obs.x + obs.width / 2, obs.y + obs.height / 2, '#ff4444', 8);

        // Remove obstacle
        state.obstacles.splice(i, 1);

        // Check game over
        if (state.heroRadius >= MAX_RADIUS) {
          state.isGameOver = true;
          // Save high score
          if (state.score > state.highScore) {
            state.highScore = state.score;
            state.isNewRecord = true;
            localStorage.setItem(HIGH_SCORE_KEY, state.score.toString());
          }
        }
        break; // Only hit one obstacle per frame
      }
    }
  }

  // Coin collisions
  for (let i = state.coins.length - 1; i >= 0; i--) {
    const coin = state.coins[i];
    if (!coin.collected && circleCircleCollision(
      HERO_X, state.heroY, heroR,
      coin.x, coin.y, coin.radius * HITBOX_SHRINK
    )) {
      coin.collected = true;
      state.score += 10;
      addFloatingText(state, coin.x, coin.y - 20, '+10', '#f59e0b');
      addParticles(state, coin.x, coin.y, '#fbbf24', 6);
      state.coins.splice(i, 1);
    }
  }

  // Shrinker collisions
  for (let i = state.shrinkers.length - 1; i >= 0; i--) {
    const shrinker = state.shrinkers[i];
    if (!shrinker.collected && circleCircleCollision(
      HERO_X, state.heroY, heroR,
      shrinker.x, shrinker.y, shrinker.radius * HITBOX_SHRINK
    )) {
      shrinker.collected = true;
      state.heroRadius *= 0.8;
      if (state.heroRadius < INITIAL_RADIUS) {
        state.heroRadius = INITIAL_RADIUS;
      }
      state.score += 5;
      addFloatingText(state, shrinker.x, shrinker.y - 20, '+5', '#10b981');
      addParticles(state, shrinker.x, shrinker.y, '#34d399', 10);
      state.shrinkers.splice(i, 1);
    }
  }
}

// ==================== MAIN APP COMPONENT ====================

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const animFrameRef = useRef<number>(0);

  const handleJump = useCallback(() => {
    const state = stateRef.current;
    if (state.isGameOver || state.isPaused) return;
    if (state.isGrounded) {
      state.velocityY = JUMP_FORCE;
      state.isGrounded = false;
    }
  }, []);

  const handleRestart = useCallback(() => {
    stateRef.current = createInitialState();
  }, []);

  const togglePause = useCallback(() => {
    const state = stateRef.current;
    if (state.isGameOver) return; // Cannot pause during game over
    state.isPaused = !state.isPaused;
  }, []);

  // ==================== UPDATE ====================
  const update = useCallback((state: GameState) => {
    if (state.isGameOver || state.isPaused) return;

    state.frameCount++;
    state.survivalTime++;

    // --- Hero Physics ---
    state.velocityY += GRAVITY;
    state.heroY += state.velocityY;

    if (state.heroY >= GROUND_Y - state.heroRadius) {
      state.heroY = GROUND_Y - state.heroRadius;
      state.velocityY = 0;
      state.isGrounded = true;
    }

    // --- Background Scroll ---
    state.scrollOffset += state.scrollSpeed;
    if (state.scrollOffset >= LINE_SPACING) {
      state.scrollOffset -= LINE_SPACING;
    }

    // --- Move Entities ---
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      state.obstacles[i].x -= state.scrollSpeed;
      if (state.obstacles[i].x + state.obstacles[i].width < -50) {
        state.obstacles.splice(i, 1);
      }
    }

    for (let i = state.coins.length - 1; i >= 0; i--) {
      state.coins[i].x -= state.scrollSpeed;
      if (state.coins[i].x < -50) state.coins.splice(i, 1);
    }

    for (let i = state.shrinkers.length - 1; i >= 0; i--) {
      state.shrinkers[i].x -= state.scrollSpeed;
      if (state.shrinkers[i].x < -50) state.shrinkers.splice(i, 1);
    }

    // --- Update Floating Texts ---
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const ft = state.floatingTexts[i];
      ft.y += ft.velocityY;
      ft.alpha -= 0.015;
      if (ft.alpha <= 0) state.floatingTexts.splice(i, 1);
    }

    // --- Update Particles ---
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
      p.alpha = p.life / 40;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // --- Visual Effect Timers ---
    if (state.flashTimer > 0) state.flashTimer--;
    if (state.speedUpTimer > 0) state.speedUpTimer--;
    if (state.invincibilityTimer > 0) state.invincibilityTimer--;

    // Screen shake decay
    if (state.screenShakeTimer > 0) {
      state.screenShakeTimer--;
      state.screenShakeX = (Math.random() - 0.5) * 5;
      state.screenShakeY = (Math.random() - 0.5) * 5;
    } else {
      state.screenShakeX = 0;
      state.screenShakeY = 0;
    }

    // Squish animation
    if (state.squishTimer > 0) {
      state.squishTimer--;
      const progress = state.squishTimer / 12;
      state.squishScaleX = 1 + progress * 0.3;
      state.squishScaleY = 1 - progress * 0.2;
    } else {
      state.squishScaleX = 1;
      state.squishScaleY = 1;
    }

    // --- DIFFICULTY SCALING ---

    // Speed increase every 3 seconds (180 frames), +4%
    state.speedTimer++;
    if (state.speedTimer >= 180) {
      state.speedTimer = 0;
      const maxSpeed = state.baseSpeed * SPEED_CAP_MULTIPLIER;
      if (state.scrollSpeed < maxSpeed) {
        state.scrollSpeed *= 1.04;
        if (state.scrollSpeed > maxSpeed) state.scrollSpeed = maxSpeed;
        // Show speed up indicator
        state.speedUpTimer = SPEED_UP_DISPLAY;
      }
    }

    // Obstacle spawn rate increase every 5 seconds (300 frames)
    state.spawnRateTimer++;
    if (state.spawnRateTimer >= 300) {
      state.spawnRateTimer = 0;
      // Reduce minimum interval by ~6 frames (0.1s), min 36 frames (0.6s)
      state.minObstacleInterval = Math.max(36, state.minObstacleInterval - 6);
    }

    // --- Spawn Timers ---
    state.obstacleTimer++;
    if (state.obstacleTimer >= state.obstacleInterval) {
      state.obstacleTimer = 0;
      spawnObstacle(state);
      // Next interval between minObstacleInterval and minObstacleInterval + 60
      state.obstacleInterval = randomRange(state.minObstacleInterval, state.minObstacleInterval + 60);
    }

    state.coinTimer++;
    // Coin spawn rate slightly reduces over time (interval increases slightly)
    const coinBaseInterval = 45 + Math.floor(state.survivalTime / 1800) * 5; // Every 30s, +5 frames
    if (state.coinTimer >= state.coinInterval) {
      state.coinTimer = 0;
      spawnCoin(state);
      state.coinInterval = randomRange(coinBaseInterval, coinBaseInterval + 45);
    }

    state.shrinkerTimer++;
    // Shrinker frequency slightly increases over time (interval decreases slightly)
    const shrinkerReduction = Math.min(120, Math.floor(state.survivalTime / 1800) * 15); // Every 30s, -15 frames
    if (state.shrinkerTimer >= state.shrinkerInterval) {
      state.shrinkerTimer = 0;
      spawnShrinker(state);
      state.shrinkerInterval = randomRange(
        Math.max(300, 480 - shrinkerReduction),
        Math.max(420, 720 - shrinkerReduction)
      );
    }

    // --- Check Collisions ---
    checkCollisions(state);
  }, []);

  // ==================== DRAW ====================
  const draw = useCallback((ctx: CanvasRenderingContext2D, state: GameState) => {
    ctx.save();

    // Apply screen shake
    if (state.screenShakeTimer > 0) {
      ctx.translate(state.screenShakeX, state.screenShakeY);
    }

    // --- Background ---
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(-5, -5, CANVAS_WIDTH + 10, CANVAS_HEIGHT + 10);

    // --- Scrolling Background Lines ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    const numLines = Math.ceil(CANVAS_WIDTH / LINE_SPACING) + 2;
    for (let i = 0; i < numLines; i++) {
      const lineX = i * LINE_SPACING - state.scrollOffset;
      ctx.beginPath();
      ctx.moveTo(lineX, 0);
      ctx.lineTo(lineX, GROUND_Y);
      ctx.stroke();
    }

    // --- Ground ---
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    // --- Obstacles ---
    for (const obs of state.obstacles) {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      // Spike top
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y);
      ctx.lineTo(obs.x + obs.width / 2, obs.y - 10);
      ctx.lineTo(obs.x + obs.width, obs.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 2;
      ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    }

    // --- Coins ---
    for (const coin of state.coins) {
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', coin.x, coin.y + 1);
    }

    // --- Shrinkers ---
    for (const shrinker of state.shrinkers) {
      const pulse = Math.sin(state.frameCount * 0.1) * 3 + 3;
      ctx.beginPath();
      ctx.arc(shrinker.x, shrinker.y, shrinker.radius + pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(52, 211, 153, 0.2)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(shrinker.x, shrinker.y, shrinker.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('−', shrinker.x, shrinker.y);
    }

    // --- Particles ---
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- Hero ---
    ctx.save();
    ctx.translate(HERO_X, state.heroY);
    ctx.scale(state.squishScaleX, state.squishScaleY);

    // Invincibility flashing
    const isInvincibleVisible = state.invincibilityTimer <= 0 || Math.floor(state.invincibilityTimer / 3) % 2 === 0;

    if (isInvincibleVisible) {
      // Red flash on hit
      if (state.flashTimer > 0) {
        const flashAlpha = state.flashTimer / 15;
        ctx.beginPath();
        ctx.arc(0, 0, state.heroRadius + 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${flashAlpha * 0.5})`;
        ctx.fill();
      }

      // Hero body
      const heroColor = state.flashTimer > 0
        ? `rgb(${Math.min(255, 37 + state.flashTimer * 15)}, ${Math.max(0, 99 - state.flashTimer * 5)}, ${Math.max(0, 235 - state.flashTimer * 15)})`
        : '#2563eb';
      ctx.beginPath();
      ctx.arc(0, 0, state.heroRadius, 0, Math.PI * 2);
      ctx.fillStyle = heroColor;
      ctx.fill();
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Highlight
      ctx.beginPath();
      ctx.arc(-state.heroRadius * 0.25, -state.heroRadius * 0.25, state.heroRadius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fill();

      // Eye
      const eyeOffset = state.heroRadius * 0.3;
      ctx.beginPath();
      ctx.arc(eyeOffset, -eyeOffset * 0.5, state.heroRadius * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeOffset + 2, -eyeOffset * 0.5, state.heroRadius * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
    }

    ctx.restore();

    // --- Floating Texts ---
    for (const ft of state.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    // --- UI: Score & Best Score ---
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${state.score}`, 15, 12);

    // Best score (small, below main score)
    ctx.fillStyle = '#6b7280';
    ctx.font = '14px Arial';
    ctx.fillText(`Best: ${state.highScore}`, 15, 36);

    // Survival timer
    ctx.fillStyle = '#4b5563';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${formatTime(state.survivalTime)}`, CANVAS_WIDTH / 2, 36);

    // --- UI: Size percentage ---
    const sizePercent = Math.round((state.heroRadius / MAX_RADIUS) * 100);
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Size: ${sizePercent}%`, CANVAS_WIDTH - 15, 12);

    // --- UI: Danger Meter ---
    const barX = 150;
    const barY = 12;
    const barWidth = CANVAS_WIDTH - 300;
    const barHeight = 18;
    const fillWidth = (state.heroRadius / MAX_RADIUS) * barWidth;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    let barColor: string;
    if (sizePercent < 50) barColor = '#22c55e';
    else if (sizePercent < 80) barColor = '#eab308';
    else barColor = '#ef4444';

    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, Math.min(fillWidth, barWidth), barHeight);

    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DANGER', barX + barWidth / 2, barY + barHeight / 2);

    // --- SPEED UP indicator ---
    if (state.speedUpTimer > 0) {
      const alpha = Math.min(1, state.speedUpTimer / 20);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡ SPEED UP! ⚡', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // Restore screen shake transform

    // --- PAUSE OVERLAY (drawn without shake) ---
    if (state.isPaused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⏸ PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '18px Arial';
      ctx.fillText('Press P or Esc to resume', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);

      ctx.fillStyle = '#e5e7eb';
      ctx.font = '16px Arial';
      ctx.fillText(`Score: ${state.score}  |  Size: ${sizePercent}%  |  Time: ${formatTime(state.survivalTime)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
    }

    // --- GAME OVER OVERLAY ---
    if (state.isGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);

      // Final score
      ctx.fillStyle = '#fff';
      ctx.font = '24px Arial';
      ctx.fillText(`Final Score: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);

      // Best score (gold if new record)
      if (state.isNewRecord) {
        // Pulsing gold text for new record
        const pulse = Math.sin(state.frameCount * 0.08) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`;
        ctx.font = 'bold 22px Arial';
        ctx.fillText(`🏆 NEW RECORD! Best: ${state.highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 5);
      } else {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '18px Arial';
        ctx.fillText(`Best Score: ${state.highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 5);
      }

      // Max size & time
      ctx.fillStyle = '#d1d5db';
      ctx.font = '18px Arial';
      ctx.fillText(`Max Size: ${Math.round(state.maxRadiusReached)}px`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
      ctx.fillText(`Time Survived: ${formatTime(state.survivalTime)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 65);

      // Restart instruction
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Arial';
      ctx.fillText('Press R or Click to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 105);
    }

  }, []);

  // ==================== GAME LOOP ====================
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;

    update(state);
    draw(ctx, state);

    // Keep frameCount incrementing even when paused/game over (for animations)
    if (state.isPaused || state.isGameOver) {
      state.frameCount++;
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  // ==================== EFFECTS & EVENT LISTENERS ====================
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(gameLoop);

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (state.isGameOver) {
          handleRestart();
        } else if (!state.isPaused) {
          handleJump();
        }
      }

      if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P' || e.code === 'Escape') {
        togglePause();
      }

      if ((e.code === 'KeyR' || e.key === 'r' || e.key === 'R') && state.isGameOver) {
        handleRestart();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        const state = stateRef.current;
        if (state.isGameOver) {
          handleRestart();
        } else if (!state.isPaused) {
          handleJump();
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const state = stateRef.current;
      if (state.isGameOver) {
        handleRestart();
      } else if (!state.isPaused) {
        handleJump();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [gameLoop, handleJump, handleRestart, togglePause]);

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 select-none">
      <h1 className="text-3xl font-bold text-white mb-2">
        🏃 Hero Runner
      </h1>
      <p className="text-gray-400 mb-4 text-sm">
        <kbd className="px-2 py-1 bg-gray-700 rounded text-white text-xs font-mono">SPACE</kbd> / <span className="text-blue-400 font-semibold">Click</span> Jump
        &nbsp;•&nbsp;
        <kbd className="px-2 py-1 bg-gray-700 rounded text-white text-xs font-mono">P</kbd> / <kbd className="px-2 py-1 bg-gray-700 rounded text-white text-xs font-mono">ESC</kbd> Pause
      </p>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-600 rounded-lg shadow-2xl cursor-pointer max-w-full"
      />
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs text-gray-500">
        <span>🟥 Obstacles = Grow + Screen Shake</span>
        <span>🟢 Green = Shrink +5</span>
        <span>🟡 Coins = +10</span>
        <span>💀 Max size = Game Over</span>
        <span>🏆 High Score saved locally</span>
      </div>
    </div>
  );
}

export default App;
