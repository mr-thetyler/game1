import { useEffect, useRef, useCallback } from 'react';

/**
 * Hero Runner - HTML5 Canvas Game (Enhanced Edition v3)
 * 
 * Features:
 * - Blue circle hero with gravity & jump (Space/Click)
 * - Red obstacles: hero grows +15%, screen shake, invincibility frames
 * - Green shrinkers: hero shrinks -20%, +5 score
 * - Yellow coins: +10 score with floating text
 * - GOLD coins (high-altitude): +25 score, need platforms to reach
 * - PURPLE double-jump power-up: 15s of mid-air second jump
 * - PLATFORMS: brown wooden platforms hero can stand on, break after 1s
 * - Game Over when radius >= 120px
 * - Continuous difficulty scaling (speed +4% every 3s, capped at 3x)
 * - Pause system (P/Esc)
 * - Local high score (localStorage)
 * - Survival timer, screen shake, invincibility frames
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
const SPEED_CAP_MULTIPLIER = 3;
const INVINCIBILITY_DURATION = 30; // 0.5s at 60fps
const HIT_ANIMATION_DURATION = 48; // 0.8s at 60fps - "ouch" face duration
const SCREEN_SHAKE_DURATION = 12; // 0.2s at 60fps
const HIGH_SCORE_KEY = 'heroRunnerHighScore';

// Platform constants
const PLATFORM_BREAK_TIME = 60; // 1 second at 60fps
const PLATFORM_CRACK_START = 36; // Start cracking at 0.6s

// Double jump constants
const DOUBLE_JUMP_DURATION = 900; // 15 seconds at 60fps
const DOUBLE_JUMP_SPAWN_MIN = 900; // 15 seconds
const DOUBLE_JUMP_SPAWN_MAX = 1200; // 20 seconds
const DOUBLE_JUMP_FIRST_DELAY = 1200; // Wait 20s before first spawn
const DOUBLE_JUMP_FORCE = -11; // Slightly weaker than normal jump

// ==================== TYPES ====================
interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Coin {
  x: number;
  y: number;
  radius: number;
  type: 'normal' | 'high' | 'doubleJump';
  sparklePhase: number;
}

interface Shrinker {
  x: number;
  y: number;
  radius: number;
}

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  standTimer: number; // How long hero has been standing on it
  breaking: boolean;
  crackLevel: number; // 0-3 crack visual intensity
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

interface SpeedLine {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
}

interface GameState {
  // Hero
  heroY: number;
  velocityY: number;
  isGrounded: boolean;
  heroRadius: number;
  maxRadiusReached: number;
  onPlatform: Platform | null; // Platform hero is currently standing on

  // Double jump
  doubleJumpActive: boolean;
  doubleJumpTimer: number;
  hasDoubleJumped: boolean; // Used for current airtime
  doubleJumpSpawnTimer: number;
  doubleJumpReadyTimer: number; // Shows "DOUBLE JUMP READY" text

  // Scrolling
  scrollOffset: number;
  scrollSpeed: number;
  baseSpeed: number;

  // Entities
  obstacles: Obstacle[];
  coins: Coin[];
  shrinkers: Shrinker[];
  platforms: Platform[];
  floatingTexts: FloatingText[];
  particles: Particle[];
  speedLines: SpeedLine[];

  // Score
  score: number;
  highScore: number;
  isNewRecord: boolean;

  // Timers
  obstacleTimer: number;
  obstacleInterval: number;
  coinTimer: number;
  coinInterval: number;
  shrinkerTimer: number;
  shrinkerInterval: number;
  platformTimer: number;
  platformInterval: number;

  // Difficulty scaling - continuous
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

  // Invincibility
  invincibilityTimer: number;

  // Hit face animation (0.8s = 48 frames)
  hitAnimationTimer: number;

  // Survival timer
  survivalTime: number;

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
    onPlatform: null,

    doubleJumpActive: false,
    doubleJumpTimer: 0,
    hasDoubleJumped: false,
    doubleJumpSpawnTimer: 0,
    doubleJumpReadyTimer: 0,

    scrollOffset: 0,
    scrollSpeed: BASE_SCROLL_SPEED,
    baseSpeed: BASE_SCROLL_SPEED,

    obstacles: [],
    coins: [],
    shrinkers: [],
    platforms: [],
    floatingTexts: [],
    particles: [],
    speedLines: [],

    score: 0,
    highScore: highScore,
    isNewRecord: false,

    obstacleTimer: 0,
    obstacleInterval: randomRange(90, 150),
    coinTimer: 0,
    coinInterval: randomRange(45, 90),
    shrinkerTimer: 0,
    shrinkerInterval: randomRange(480, 720),
    platformTimer: 0,
    platformInterval: randomRange(120, 240),

    speedTimer: 0,
    spawnRateTimer: 0,
    minObstacleInterval: 90,

    flashTimer: 0,
    squishTimer: 0,
    squishScaleX: 1,
    squishScaleY: 1,
    screenShakeTimer: 0,
    screenShakeX: 0,
    screenShakeY: 0,

    invincibilityTimer: 0,
    hitAnimationTimer: 0,

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
  return Math.sqrt(dx * dx + dy * dy) < (r1 + r2);
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
    width,
    height,
  });
}

function spawnCoin(state: GameState): void {
  // 20% chance of high-altitude coin (needs platforms)
  const isHigh = Math.random() < 0.2;
  const y = isHigh
    ? randomRange(40, GROUND_Y - 200) // High up, needs platform
    : randomRange(GROUND_Y - 150, GROUND_Y - 20);

  state.coins.push({
    x: CANVAS_WIDTH + 20,
    y,
    radius: isHigh ? 14 : 12,
    type: isHigh ? 'high' : 'normal',
    sparklePhase: Math.random() * Math.PI * 2,
  });
}

function spawnShrinker(state: GameState): void {
  const y = randomRange(GROUND_Y - 180, GROUND_Y - 60);
  state.shrinkers.push({ x: CANVAS_WIDTH + 20, y, radius: 15 });
}

/** Spawn a platform at varying heights */
function spawnPlatform(state: GameState): void {
  // Different height tiers
  const tier = Math.random();
  let y: number;
  if (tier < 0.4) {
    // Low platform (easy jump from ground)
    y = GROUND_Y - randomRange(60, 90);
  } else if (tier < 0.75) {
    // Medium platform
    y = GROUND_Y - randomRange(110, 160);
  } else {
    // High platform (needs platform hopping or perfect timing)
    y = GROUND_Y - randomRange(180, 230);
  }

  const width = randomRange(70, 120);
  const height = 14;

  state.platforms.push({
    x: CANVAS_WIDTH + 20,
    y,
    width,
    height,
    standTimer: 0,
    breaking: false,
    crackLevel: 0,
  });
}

/** Spawn double jump power-up (purple coin) - only after 20s */
function spawnDoubleJumpPowerUp(state: GameState): void {
  // Only spawn if game has been running for at least 20 seconds
  if (state.survivalTime < DOUBLE_JUMP_FIRST_DELAY) return;
  // Don't spawn if already active
  if (state.doubleJumpActive) return;

  const y = randomRange(GROUND_Y - 180, GROUND_Y - 80);
  state.coins.push({
    x: CANVAS_WIDTH + 20,
    y,
    radius: 16,
    type: 'doubleJump',
    sparklePhase: 0,
  });
}

function addFloatingText(state: GameState, x: number, y: number, text: string, color: string): void {
  state.floatingTexts.push({ x, y, text, color, alpha: 1.0, velocityY: -2 });
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
      color,
      alpha: 1.0,
      life: randomRange(20, 40),
    });
  }
}

/** Add speed lines for subtle speed increase feedback */
function addSpeedLine(state: GameState): void {
  state.speedLines.push({
    x: CANVAS_WIDTH + 10,
    y: randomRange(20, GROUND_Y - 20),
    length: randomRange(20, 60),
    speed: state.scrollSpeed * randomRange(2, 4),
    alpha: 0.4 + Math.random() * 0.3,
  });
}

// ==================== COLLISION DETECTION ====================

function checkCollisions(state: GameState): void {
  const heroR = state.heroRadius * HITBOX_SHRINK;

  // Obstacle collisions (only if not invincible)
  if (state.invincibilityTimer <= 0) {
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obs = state.obstacles[i];
      if (circleRectCollision(HERO_X, state.heroY, heroR, obs.x, obs.y, obs.width, obs.height)) {
        state.heroRadius *= 1.15;
        if (state.heroRadius > state.maxRadiusReached) state.maxRadiusReached = state.heroRadius;

        state.flashTimer = 15;
        state.squishTimer = 12;
        state.screenShakeTimer = SCREEN_SHAKE_DURATION;
        state.invincibilityTimer = INVINCIBILITY_DURATION;
        state.hitAnimationTimer = HIT_ANIMATION_DURATION; // "Ouch!" face for 0.8s

        addParticles(state, obs.x + obs.width / 2, obs.y + obs.height / 2, '#ff4444', 8);
        // "Ouch!" floating text above hero
        addFloatingText(state, HERO_X, state.heroY - state.heroRadius - 15, 'Ouch!', '#ef4444');
        state.obstacles.splice(i, 1);

        if (state.heroRadius >= MAX_RADIUS) {
          state.isGameOver = true;
          if (state.score > state.highScore) {
            state.highScore = state.score;
            state.isNewRecord = true;
            localStorage.setItem(HIGH_SCORE_KEY, state.score.toString());
          }
        }
        break;
      }
    }
  }

  // Coin collisions
  for (let i = state.coins.length - 1; i >= 0; i--) {
    const coin = state.coins[i];
    if (circleCircleCollision(HERO_X, state.heroY, heroR, coin.x, coin.y, coin.radius * HITBOX_SHRINK)) {
      if (coin.type === 'doubleJump') {
        // Activate double jump power-up
        state.doubleJumpActive = true;
        state.doubleJumpTimer = DOUBLE_JUMP_DURATION;
        state.hasDoubleJumped = false;
        state.doubleJumpReadyTimer = 120; // Show text for 2 seconds
        addFloatingText(state, coin.x, coin.y - 20, '2x JUMP!', '#a855f7');
        addParticles(state, coin.x, coin.y, '#c084fc', 12);
      } else if (coin.type === 'high') {
        // High-altitude coin worth +25
        state.score += 25;
        addFloatingText(state, coin.x, coin.y - 20, '+25', '#fbbf24');
        addParticles(state, coin.x, coin.y, '#fcd34d', 10);
      } else {
        // Normal coin worth +10
        state.score += 10;
        addFloatingText(state, coin.x, coin.y - 20, '+10', '#f59e0b');
        addParticles(state, coin.x, coin.y, '#fbbf24', 6);
      }
      state.coins.splice(i, 1);
    }
  }

  // Shrinker collisions
  for (let i = state.shrinkers.length - 1; i >= 0; i--) {
    const shrinker = state.shrinkers[i];
    if (circleCircleCollision(HERO_X, state.heroY, heroR, shrinker.x, shrinker.y, shrinker.radius * HITBOX_SHRINK)) {
      state.heroRadius *= 0.8;
      if (state.heroRadius < INITIAL_RADIUS) state.heroRadius = INITIAL_RADIUS;
      state.score += 5;
      addFloatingText(state, shrinker.x, shrinker.y - 20, '+5', '#10b981');
      addParticles(state, shrinker.x, shrinker.y, '#34d399', 10);
      state.shrinkers.splice(i, 1);
    }
  }
}

// ==================== PLATFORM COLLISION ====================

/**
 * Check if hero should land on a platform.
 * Only lands from above (hero falling, hero bottom near platform top).
 * Returns the platform if hero lands on it, null otherwise.
 */
function checkPlatformLanding(state: GameState): Platform | null {
  // Only land if falling
  if (state.velocityY <= 0) return null;

  const heroBottom = state.heroY + state.heroRadius;
  const heroPrevBottom = heroBottom - state.velocityY; // Where hero was last frame

  for (const platform of state.platforms) {
    if (platform.breaking && platform.crackLevel >= 3) continue; // Broken platform

    // Check horizontal overlap
    const heroLeft = HERO_X - state.heroRadius * 0.6;
    const heroRight = HERO_X + state.heroRadius * 0.6;
    const platLeft = platform.x;
    const platRight = platform.x + platform.width;

    if (heroRight > platLeft && heroLeft < platRight) {
      // Check if hero crossed the platform top this frame
      if (heroPrevBottom <= platform.y && heroBottom >= platform.y) {
        return platform;
      }
    }
  }
  return null;
}

// ==================== MAIN APP COMPONENT ====================

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const animFrameRef = useRef<number>(0);

  const handleJump = useCallback(() => {
    const state = stateRef.current;
    if (state.isGameOver || state.isPaused) return;

    if (state.isGrounded || state.onPlatform) {
      // Normal jump from ground or platform
      state.velocityY = JUMP_FORCE;
      state.isGrounded = false;
      state.onPlatform = null;
      state.hasDoubleJumped = false; // Reset double jump for this airtime
    } else if (state.doubleJumpActive && !state.hasDoubleJumped) {
      // Double jump in mid-air
      state.velocityY = DOUBLE_JUMP_FORCE;
      state.hasDoubleJumped = true;
      // Purple particles for double jump
      addParticles(state, HERO_X, state.heroY, '#c084fc', 8);
    }
  }, []);

  const handleRestart = useCallback(() => {
    stateRef.current = createInitialState();
  }, []);

  const togglePause = useCallback(() => {
    const state = stateRef.current;
    if (state.isGameOver) return;
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

    // Platform landing check (before ground check)
    const landedPlatform = checkPlatformLanding(state);
    if (landedPlatform) {
      state.heroY = landedPlatform.y - state.heroRadius;
      state.velocityY = 0;
      state.isGrounded = false; // Not on ground, but on platform
      state.onPlatform = landedPlatform;
      state.hasDoubleJumped = false; // Can double jump off platform too
    }

    // If on a platform, track standing time
    if (state.onPlatform) {
      // Verify hero is still on the platform (horizontal overlap)
      const heroLeft = HERO_X - state.heroRadius * 0.6;
      const heroRight = HERO_X + state.heroRadius * 0.6;
      const plat = state.onPlatform;
      const platLeft = plat.x;
      const platRight = plat.x + plat.width;

      if (heroRight > platLeft && heroLeft < platRight) {
        plat.standTimer++;
        // Update crack level
        if (plat.standTimer >= PLATFORM_BREAK_TIME) {
          plat.crackLevel = 3; // Fully broken
        } else if (plat.standTimer >= PLATFORM_CRACK_START) {
          plat.crackLevel = Math.floor((plat.standTimer - PLATFORM_CRACK_START) / ((PLATFORM_BREAK_TIME - PLATFORM_CRACK_START) / 3)) + 1;
          plat.breaking = true;
        }
      } else {
        // Hero walked off platform
        state.onPlatform = null;
      }
    }

    // Ground collision
    if (state.heroY >= GROUND_Y - state.heroRadius) {
      state.heroY = GROUND_Y - state.heroRadius;
      state.velocityY = 0;
      state.isGrounded = true;
      state.onPlatform = null;
      state.hasDoubleJumped = false;
    }

    // If hero fell below platform without landing, clear onPlatform
    if (state.onPlatform && state.velocityY > 0) {
      const heroBottom = state.heroY + state.heroRadius;
      if (heroBottom > state.onPlatform.y + 20) {
        state.onPlatform = null;
      }
    }

    // --- Double Jump Timer ---
    if (state.doubleJumpActive) {
      state.doubleJumpTimer--;
      if (state.doubleJumpTimer <= 0) {
        state.doubleJumpActive = false;
        state.hasDoubleJumped = false;
      }
    }
    if (state.doubleJumpReadyTimer > 0) state.doubleJumpReadyTimer--;

    // --- Background Scroll ---
    state.scrollOffset += state.scrollSpeed;
    if (state.scrollOffset >= LINE_SPACING) {
      state.scrollOffset -= LINE_SPACING;
    }

    // --- Move Entities ---
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      state.obstacles[i].x -= state.scrollSpeed;
      if (state.obstacles[i].x + state.obstacles[i].width < -50) state.obstacles.splice(i, 1);
    }

    for (let i = state.coins.length - 1; i >= 0; i--) {
      state.coins[i].x -= state.scrollSpeed;
      if (state.coins[i].x < -50) state.coins.splice(i, 1);
    }

    for (let i = state.shrinkers.length - 1; i >= 0; i--) {
      state.shrinkers[i].x -= state.scrollSpeed;
      if (state.shrinkers[i].x < -50) state.shrinkers.splice(i, 1);
    }

    // Move platforms
    for (let i = state.platforms.length - 1; i >= 0; i--) {
      const plat = state.platforms[i];
      plat.x -= state.scrollSpeed;

      // Remove if off screen or fully broken
      if (plat.x + plat.width < -50 || plat.crackLevel >= 3) {
        // If hero was on this platform, detach
        if (state.onPlatform === plat) {
          state.onPlatform = null;
        }
        // Break particles
        if (plat.crackLevel >= 3) {
          addParticles(state, plat.x + plat.width / 2, plat.y, '#92400e', 6);
        }
        state.platforms.splice(i, 1);
      }
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

    // --- Update Speed Lines ---
    for (let i = state.speedLines.length - 1; i >= 0; i--) {
      const sl = state.speedLines[i];
      sl.x -= sl.speed;
      sl.alpha -= 0.02;
      if (sl.x + sl.length < 0 || sl.alpha <= 0) state.speedLines.splice(i, 1);
    }

    // Spawn speed lines based on current speed (more lines = faster)
    if (state.frameCount % Math.max(2, Math.floor(10 - state.scrollSpeed)) === 0) {
      addSpeedLine(state);
    }

    // --- Visual Effect Timers ---
    if (state.flashTimer > 0) state.flashTimer--;
    if (state.invincibilityTimer > 0) state.invincibilityTimer--;
    if (state.hitAnimationTimer > 0) state.hitAnimationTimer--;

    // Screen shake
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

    // --- CONTINUOUS DIFFICULTY SCALING (BUG FIX) ---
    // Speed increases EVERY 3 seconds, continuously, until cap
    state.speedTimer++;
    if (state.speedTimer >= 180) { // 3 seconds
      state.speedTimer = 0;
      const maxSpeed = state.baseSpeed * SPEED_CAP_MULTIPLIER;
      if (state.scrollSpeed < maxSpeed) {
        state.scrollSpeed *= 1.04; // +4%
        if (state.scrollSpeed > maxSpeed) state.scrollSpeed = maxSpeed;
      }
      // NO other condition stops this - it runs forever until cap
    }

    // Obstacle spawn rate increase every 5 seconds
    state.spawnRateTimer++;
    if (state.spawnRateTimer >= 300) {
      state.spawnRateTimer = 0;
      state.minObstacleInterval = Math.max(36, state.minObstacleInterval - 6);
    }

    // --- Spawn Timers ---
    state.obstacleTimer++;
    if (state.obstacleTimer >= state.obstacleInterval) {
      state.obstacleTimer = 0;
      spawnObstacle(state);
      state.obstacleInterval = randomRange(state.minObstacleInterval, state.minObstacleInterval + 60);
    }

    state.coinTimer++;
    const coinBaseInterval = 45 + Math.floor(state.survivalTime / 1800) * 5;
    if (state.coinTimer >= state.coinInterval) {
      state.coinTimer = 0;
      spawnCoin(state);
      state.coinInterval = randomRange(coinBaseInterval, coinBaseInterval + 45);
    }

    state.shrinkerTimer++;
    const shrinkerReduction = Math.min(120, Math.floor(state.survivalTime / 1800) * 15);
    if (state.shrinkerTimer >= state.shrinkerInterval) {
      state.shrinkerTimer = 0;
      spawnShrinker(state);
      state.shrinkerInterval = randomRange(
        Math.max(300, 480 - shrinkerReduction),
        Math.max(420, 720 - shrinkerReduction)
      );
    }

    // Platform spawning - increases with speed
    state.platformTimer++;
    const platformIntervalAdjusted = Math.max(60, state.platformInterval - Math.floor(state.scrollSpeed * 5));
    if (state.platformTimer >= platformIntervalAdjusted) {
      state.platformTimer = 0;
      spawnPlatform(state);
      state.platformInterval = randomRange(90, 200);
    }

    // Double jump power-up spawning
    state.doubleJumpSpawnTimer++;
    const djInterval = randomRange(DOUBLE_JUMP_SPAWN_MIN, DOUBLE_JUMP_SPAWN_MAX);
    if (state.doubleJumpSpawnTimer >= djInterval) {
      state.doubleJumpSpawnTimer = 0;
      spawnDoubleJumpPowerUp(state);
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

    // --- Speed Lines (subtle visual feedback for speed) ---
    for (const sl of state.speedLines) {
      ctx.globalAlpha = Math.max(0, sl.alpha);
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sl.x, sl.y);
      ctx.lineTo(sl.x + sl.length, sl.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // --- Ground ---
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    // --- Platforms (brown/wooden) ---
    for (const plat of state.platforms) {
      // Skip fully broken
      if (plat.crackLevel >= 3) continue;

      // Shake if breaking
      let drawX = plat.x;
      let drawY = plat.y;
      if (plat.breaking) {
        drawX += (Math.random() - 0.5) * plat.crackLevel * 2;
        drawY += (Math.random() - 0.5) * plat.crackLevel;
      }

      // Platform body (wooden brown)
      ctx.fillStyle = '#92400e';
      ctx.fillRect(drawX, drawY, plat.width, plat.height);

      // Wood grain lines
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1;
      for (let g = 0; g < 3; g++) {
        const gy = drawY + 3 + g * 4;
        ctx.beginPath();
        ctx.moveTo(drawX + 2, gy);
        ctx.lineTo(drawX + plat.width - 2, gy);
        ctx.stroke();
      }

      // Platform border
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, plat.width, plat.height);

      // Top highlight
      ctx.fillStyle = '#b45309';
      ctx.fillRect(drawX, drawY, plat.width, 3);

      // Crack lines (when breaking)
      if (plat.crackLevel >= 1) {
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 1.5;
        // Crack 1
        ctx.beginPath();
        ctx.moveTo(drawX + plat.width * 0.3, drawY);
        ctx.lineTo(drawX + plat.width * 0.35, drawY + plat.height * 0.5);
        ctx.lineTo(drawX + plat.width * 0.28, drawY + plat.height);
        ctx.stroke();
      }
      if (plat.crackLevel >= 2) {
        // Crack 2
        ctx.beginPath();
        ctx.moveTo(drawX + plat.width * 0.7, drawY);
        ctx.lineTo(drawX + plat.width * 0.65, drawY + plat.height * 0.6);
        ctx.lineTo(drawX + plat.width * 0.72, drawY + plat.height);
        ctx.stroke();
      }
      if (plat.crackLevel >= 3) {
        // Crack 3 - X pattern
        ctx.beginPath();
        ctx.moveTo(drawX + plat.width * 0.45, drawY + 2);
        ctx.lineTo(drawX + plat.width * 0.55, drawY + plat.height - 2);
        ctx.moveTo(drawX + plat.width * 0.55, drawY + 2);
        ctx.lineTo(drawX + plat.width * 0.45, drawY + plat.height - 2);
        ctx.stroke();
      }
    }

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
      if (coin.type === 'doubleJump') {
        // Purple double-jump power-up coin
        const pulse = Math.sin(state.frameCount * 0.15) * 3 + 3;
        // Glow
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius + pulse + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
        ctx.fill();
        // Body
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#a855f7';
        ctx.fill();
        ctx.strokeStyle = '#7c3aed';
        ctx.lineWidth = 2;
        ctx.stroke();
        // "2x" text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('2x', coin.x, coin.y);
        // Sparkle
        const sparkleAngle = state.frameCount * 0.05;
        for (let s = 0; s < 4; s++) {
          const sa = sparkleAngle + (Math.PI / 2) * s;
          const sx = coin.x + Math.cos(sa) * (coin.radius + 6);
          const sy = coin.y + Math.sin(sa) * (coin.radius + 6);
          ctx.fillStyle = 'rgba(196, 181, 253, 0.8)';
          ctx.beginPath();
          ctx.arc(sx, sy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (coin.type === 'high') {
        // High-altitude gold coin with sparkle
        const sparkle = Math.sin(state.frameCount * 0.12 + coin.sparklePhase) * 0.3 + 0.7;
        // Outer sparkle ring
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(252, 211, 77, ${sparkle * 0.3})`;
        ctx.fill();
        // Body
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Star/diamond shape inside
        ctx.fillStyle = '#92400e';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', coin.x, coin.y + 1);
        // Sparkle particles
        for (let s = 0; s < 3; s++) {
          const sa = state.frameCount * 0.08 + (Math.PI * 2 / 3) * s;
          const sr = coin.radius + 8 + Math.sin(state.frameCount * 0.1 + s) * 3;
          const sx = coin.x + Math.cos(sa) * sr;
          const sy = coin.y + Math.sin(sa) * sr;
          ctx.globalAlpha = sparkle;
          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        // Normal yellow coin
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

    // Double jump purple aura
    if (state.doubleJumpActive) {
      const auraPulse = Math.sin(state.frameCount * 0.1) * 5 + 10;
      const auraAlpha = 0.2 + Math.sin(state.frameCount * 0.08) * 0.1;
      ctx.beginPath();
      ctx.arc(0, 0, state.heroRadius + auraPulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(168, 85, 247, ${auraAlpha})`;
      ctx.fill();
      // Second aura ring
      ctx.beginPath();
      ctx.arc(0, 0, state.heroRadius + auraPulse + 5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(196, 181, 253, ${auraAlpha * 0.5})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

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

      // Hero body - red/orange during hit animation, otherwise blue
      let heroColor: string;
      if (state.hitAnimationTimer > 0) {
        // Transition from red to orange during hit animation
        const hitProgress = state.hitAnimationTimer / HIT_ANIMATION_DURATION;
        const r = 239;
        const g = Math.floor(68 + (1 - hitProgress) * 80);
        const b = Math.floor(68 * (1 - hitProgress));
        heroColor = `rgb(${r}, ${g}, ${b})`;
      } else if (state.flashTimer > 0) {
        heroColor = `rgb(${Math.min(255, 37 + state.flashTimer * 15)}, ${Math.max(0, 99 - state.flashTimer * 5)}, ${Math.max(0, 235 - state.flashTimer * 15)})`;
      } else {
        heroColor = '#2563eb';
      }

      ctx.beginPath();
      ctx.arc(0, 0, state.heroRadius, 0, Math.PI * 2);
      ctx.fillStyle = heroColor;
      ctx.fill();
      ctx.strokeStyle = state.hitAnimationTimer > 0 ? '#991b1b' : '#1d4ed8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Highlight (skip during hit animation for more "hurt" look)
      if (state.hitAnimationTimer <= 0) {
        ctx.beginPath();
        ctx.arc(-state.heroRadius * 0.25, -state.heroRadius * 0.25, state.heroRadius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fill();
      }

      // --- FACE DRAWING ---
      if (state.hitAnimationTimer > 0) {
        // "OUCH" FACE: Two squeezed eyes (> <) and open "O" mouth
        const r = state.heroRadius;
        const eyeY = -r * 0.15;
        const eyeSize = r * 0.2;

        // Left squeezed eye: ">" shape (downward-curving arc)
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = Math.max(2, r * 0.08);
        ctx.lineCap = 'round';
        // Left eye ">" - two lines forming a V pointing right
        ctx.beginPath();
        ctx.moveTo(-r * 0.35 - eyeSize, eyeY - eyeSize * 0.7);
        ctx.lineTo(-r * 0.35, eyeY);
        ctx.lineTo(-r * 0.35 - eyeSize, eyeY + eyeSize * 0.7);
        ctx.stroke();

        // Right eye "<" - two lines forming a V pointing left
        ctx.beginPath();
        ctx.moveTo(r * 0.35 + eyeSize, eyeY - eyeSize * 0.7);
        ctx.lineTo(r * 0.35, eyeY);
        ctx.lineTo(r * 0.35 + eyeSize, eyeY + eyeSize * 0.7);
        ctx.stroke();

        // Open "O" mouth - oval shape showing shock/pain
        const mouthY = r * 0.25;
        const mouthW = r * 0.2;
        const mouthH = r * 0.25;
        // Mouth wobble based on animation progress
        const wobble = Math.sin(state.hitAnimationTimer * 0.5) * r * 0.03;
        ctx.beginPath();
        ctx.ellipse(wobble, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();
        // Inner mouth (tongue/throat)
        ctx.beginPath();
        ctx.ellipse(wobble, mouthY + mouthH * 0.2, mouthW * 0.5, mouthH * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#991b1b';
        ctx.fill();

        ctx.lineCap = 'butt'; // Reset line cap
      } else {
        // NORMAL FACE: One big white eye with black pupil + small smile
        const eyeOffset = state.heroRadius * 0.3;
        // Eye white
        ctx.beginPath();
        ctx.arc(eyeOffset, -eyeOffset * 0.5, state.heroRadius * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        // Pupil
        ctx.beginPath();
        ctx.arc(eyeOffset + 2, -eyeOffset * 0.5, state.heroRadius * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();

        // Small smile (neutral/happy mouth)
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = Math.max(1.5, state.heroRadius * 0.06);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(eyeOffset * 0.3, state.heroRadius * 0.15, state.heroRadius * 0.15, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
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

    // --- "DOUBLE JUMP READY" text ---
    if (state.doubleJumpReadyTimer > 0) {
      const alpha = Math.min(1, state.doubleJumpReadyTimer / 30);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡ DOUBLE JUMP READY! ⚡', CANVAS_WIDTH / 2, 70);
      ctx.globalAlpha = 1;
    }

    // --- UI: Score & Best ---
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${state.score}`, 15, 12);

    ctx.fillStyle = '#6b7280';
    ctx.font = '14px Arial';
    ctx.fillText(`Best: ${state.highScore}`, 15, 36);

    // Survival timer
    ctx.fillStyle = '#4b5563';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${formatTime(state.survivalTime)}`, CANVAS_WIDTH / 2, 36);

    // Speed multiplier indicator
    const speedMultiplier = (state.scrollSpeed / state.baseSpeed).toFixed(1);
    const speedColor = state.scrollSpeed >= state.baseSpeed * 2.5 ? '#ef4444' :
                       state.scrollSpeed >= state.baseSpeed * 1.5 ? '#f59e0b' : '#22c55e';
    ctx.fillStyle = speedColor;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`⚡ Speed: x${speedMultiplier}`, CANVAS_WIDTH / 2, 52);

    // Double jump timer indicator
    if (state.doubleJumpActive) {
      const djSecondsLeft = Math.ceil(state.doubleJumpTimer / 60);
      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`2x JUMP: ${djSecondsLeft}s`, CANVAS_WIDTH / 2, 68);
    }

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

    ctx.restore(); // End screen shake transform

    // --- PAUSE OVERLAY ---
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

      ctx.fillStyle = '#fff';
      ctx.font = '24px Arial';
      ctx.fillText(`Final Score: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);

      if (state.isNewRecord) {
        const pulse = Math.sin(state.frameCount * 0.08) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`;
        ctx.font = 'bold 22px Arial';
        ctx.fillText(`🏆 NEW RECORD! Best: ${state.highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 5);
      } else {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '18px Arial';
        ctx.fillText(`Best Score: ${state.highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 5);
      }

      ctx.fillStyle = '#d1d5db';
      ctx.font = '18px Arial';
      ctx.fillText(`Max Size: ${Math.round(state.maxRadiusReached)}px`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
      ctx.fillText(`Time Survived: ${formatTime(state.survivalTime)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 65);

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
      <div className="mt-4 flex flex-wrap gap-3 justify-center text-xs text-gray-500">
        <span>🟥 Obstacles = Grow</span>
        <span>🟢 Green = Shrink +5</span>
        <span>🟡 Coins = +10</span>
        <span>⭐ Gold = +25 (use platforms!)</span>
        <span>🟣 Purple = Double Jump</span>
        <span>🟫 Platforms = Jump higher (break after 1s)</span>
      </div>
    </div>
  );
}

export default App;
