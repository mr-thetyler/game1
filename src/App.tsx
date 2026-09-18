import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hero Runner - HTML5 Canvas Game with Level System
 * 
 * All 8 critical fixes applied:
 * 1. More platforms at different heights
 * 2. Fixed hero growth on hit
 * 3. Auto-close level complete popup
 * 4. More diverse obstacles
 * 5. Removed collision effect from shrinker
 * 6. Reduced empty space at top
 * 7. Better coin distribution
 * 8. Level 3 difficulty x5
 */

// ==================== LEVEL DATA ====================
const levels = [
  {
    id: 1,
    name: "Forest Meadow",
    targetTime: 60,
    background: "#87CEEB",
    groundColor: "#228B22",
    obstacleFrequency: 1.0,
    birdFrequency: 0.3,
    platformFrequency: 1.2,
    speedGrowthRate: 0.008,
    maxSpeedMultiplier: 3.0,
    coinMultiplier: 1.0
  },
  {
    id: 2,
    name: "Desert Dunes",
    targetTime: 90,
    background: "#FFE4B5",
    groundColor: "#D2691E",
    obstacleFrequency: 1.2,
    birdFrequency: 0.6,
    platformFrequency: 0.9,
    speedGrowthRate: 0.010,
    maxSpeedMultiplier: 3.0,
    coinMultiplier: 1.0
  },
  {
    id: 3,
    name: "Mountain Peak",
    targetTime: 120,
    background: "#E0E0E0",
    groundColor: "#696969",
    obstacleFrequency: 1.8,
    birdFrequency: 1.5,
    platformFrequency: 1.3,
    speedGrowthRate: 0.018,
    maxSpeedMultiplier: 5.0,
    coinMultiplier: 0.9
  },
  {
    id: 4,
    name: "Volcanic Fury",
    targetTime: 150,
    background: "#2F1B1B",
    groundColor: "#8B0000",
    obstacleFrequency: 1.6,
    birdFrequency: 1.2,
    platformFrequency: 0.8,
    speedGrowthRate: 0.015,
    maxSpeedMultiplier: 4.0,
    coinMultiplier: 0.95
  },
  {
    id: 5,
    name: "Cosmic Void",
    targetTime: 180,
    background: "#0D0221",
    groundColor: "#4B0082",
    obstacleFrequency: 1.8,
    birdFrequency: 1.5,
    platformFrequency: 1.0,
    speedGrowthRate: 0.018,
    maxSpeedMultiplier: 4.0,
    coinMultiplier: 0.9
  }
];

// ==================== GAME STATES ====================
type GameScreen = 'MENU' | 'PLAYING' | 'PAUSED' | 'LEVEL_COMPLETE' | 'GAME_OVER';

// ==================== CONSTANTS ====================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_Y = 320; // FIX #6: Reduced from 350 to 320
const INITIAL_RADIUS = 30;
const HERO_X = 100;
const GRAVITY = 0.6;
const JUMP_FORCE = -13;
const BASE_SCROLL_SPEED = 3;
const LINE_SPACING = 80;
const MAX_RADIUS = 120;
const HITBOX_SHRINK = 0.9;
const INVINCIBILITY_DURATION = 30;
const HIT_ANIMATION_DURATION = 48;
const SCREEN_SHAKE_DURATION = 12;
const HIGH_SCORE_KEY = 'heroRunnerHighScore';
const PROGRESS_KEY = 'heroRunnerProgress';

const PLATFORM_BREAK_TIME = 60;
const PLATFORM_CRACK_START = 36;

const DOUBLE_JUMP_DURATION = 900;
const DOUBLE_JUMP_SPAWN_MIN = 900;
const DOUBLE_JUMP_SPAWN_MAX = 1200;
const DOUBLE_JUMP_FIRST_DELAY = 1200;
const DOUBLE_JUMP_FORCE = -11;

const ICE_SHIELD_DURATION = 600;
const ICE_SHIELD_SPAWN_MIN = 720;
const ICE_SHIELD_SPAWN_MAX = 1080;

const FLYING_OBSTACLE_SPAWN_MIN = 240; // FIX #4: 4 seconds (was 5)
const FLYING_OBSTACLE_SPAWN_MAX = 360; // FIX #4: 6 seconds (was 10)
const FLYING_OBSTACLE_FIRST_DELAY = 600;
const FLYING_OBSTACLE_BASE_SPEED = 4;
const FLYING_OBSTACLE_SAFE_DISTANCE = 150;
const FLYING_OBSTACLE_WIDTH = 30;
const FLYING_OBSTACLE_HEIGHT = 20;
const FLYING_OBSTACLE_HITBOX = 20;

// ==================== TYPES ====================
interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'low' | 'medium' | 'high' | 'spiked' | 'double';
}

interface FlyingObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  verticalDrift: number;
  rotation: number;
  wingPhase: number;
}

interface Coin {
  x: number;
  y: number;
  radius: number;
  type: 'normal' | 'high' | 'doubleJump' | 'iceShield';
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
  standTimer: number;
  breaking: boolean;
  crackLevel: number;
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
  heroY: number;
  velocityY: number;
  isGrounded: boolean;
  heroRadius: number;
  maxRadiusReached: number;
  onPlatform: Platform | null;

  doubleJumpActive: boolean;
  doubleJumpTimer: number;
  hasDoubleJumped: boolean;
  doubleJumpSpawnTimer: number;
  doubleJumpReadyTimer: number;

  iceShieldActive: boolean;
  iceShieldTimer: number;
  iceShieldSpawnTimer: number;

  scrollOffset: number;
  scrollSpeed: number;
  baseSpeed: number;

  obstacles: Obstacle[];
  flyingObstacles: FlyingObstacle[];
  coins: Coin[];
  shrinkers: Shrinker[];
  platforms: Platform[];
  floatingTexts: FloatingText[];
  particles: Particle[];
  speedLines: SpeedLine[];

  score: number;
  highScore: number;
  isNewRecord: boolean;

  obstacleTimer: number;
  obstacleInterval: number;
  flyingObstacleTimer: number;
  flyingObstacleInterval: number;
  coinTimer: number;
  coinInterval: number;
  shrinkerTimer: number;
  shrinkerInterval: number;
  platformTimer: number;
  platformInterval: number;

  speedTimer: number;
  spawnRateTimer: number;
  minObstacleInterval: number;

  flashTimer: number;
  squishTimer: number;
  squishScaleX: number;
  squishScaleY: number;
  screenShakeTimer: number;
  screenShakeX: number;
  screenShakeY: number;

  invincibilityTimer: number;
  hitAnimationTimer: number;

  survivalTime: number;
  levelTime: number;

  isPaused: boolean;
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

    iceShieldActive: false,
    iceShieldTimer: 0,
    iceShieldSpawnTimer: 0,

    scrollOffset: 0,
    scrollSpeed: BASE_SCROLL_SPEED,
    baseSpeed: BASE_SCROLL_SPEED,

    obstacles: [],
    flyingObstacles: [],
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
    obstacleInterval: randomRange(90, 150), // FIX #4: Reduced from 120-180
    flyingObstacleTimer: 0,
    flyingObstacleInterval: randomRange(FLYING_OBSTACLE_SPAWN_MIN, FLYING_OBSTACLE_SPAWN_MAX),
    coinTimer: 0,
    coinInterval: 120, // FIX #7: Increased from 45-90 to 120
    shrinkerTimer: 0,
    shrinkerInterval: randomRange(480, 720),
    platformTimer: 0,
    platformInterval: randomRange(60, 120), // FIX #1: Reduced from 120-240

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
    levelTime: 0,

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

function spawnObstacle(state: GameState, level: typeof levels[0]): void {
  const rand = Math.random();
  let obstacle: Obstacle;

  // FIX #4: 3 types of obstacles + spiked + double
  if (rand < 0.10) {
    // Double obstacle (10%)
    const height = randomRange(60, 90);
    obstacle = {
      x: CANVAS_WIDTH + 20,
      y: GROUND_Y - height,
      width: 25,
      height,
      type: 'double'
    };
    state.obstacles.push(obstacle);
    // Add second pillar with 40px gap
    state.obstacles.push({
      x: CANVAS_WIDTH + 20 + 25 + 40,
      y: GROUND_Y - height,
      width: 25,
      height,
      type: 'double'
    });
    return;
  } else if (rand < 0.30) {
    // Low obstacle (20%)
    const height = randomRange(30, 50);
    obstacle = {
      x: CANVAS_WIDTH + 20,
      y: GROUND_Y - height,
      width: randomRange(25, 35),
      height,
      type: 'low'
    };
  } else if (rand < 0.60) {
    // Medium obstacle (30%)
    const height = randomRange(60, 90);
    obstacle = {
      x: CANVAS_WIDTH + 20,
      y: GROUND_Y - height,
      width: randomRange(25, 40),
      height,
      type: 'medium'
    };
  } else if (rand < 0.80) {
    // High obstacle (20%)
    const height = randomRange(100, 130);
    obstacle = {
      x: CANVAS_WIDTH + 20,
      y: GROUND_Y - height,
      width: randomRange(25, 40),
      height,
      type: 'high'
    };
  } else {
    // Spiked obstacle (20%)
    const height = randomRange(50, 80);
    obstacle = {
      x: CANVAS_WIDTH + 20,
      y: GROUND_Y - height,
      width: randomRange(25, 40),
      height,
      type: 'spiked'
    };
  }

  state.obstacles.push(obstacle);
  console.log(`[SPAWN] Obstacle: ${obstacle.type} at x=${obstacle.x}, y=${obstacle.y}`);
}

function spawnFlyingObstacle(state: GameState): void {
  if (state.survivalTime < FLYING_OBSTACLE_FIRST_DELAY) return;

  const speedMultiplier = state.scrollSpeed / state.baseSpeed;
  const spawnX = CANVAS_WIDTH + 50;

  const tier = Math.random();
  let startY: number;
  
  if (tier < 0.60) {
    startY = randomRange(100, 200);
  } else if (tier < 0.85) {
    startY = randomRange(50, 100);
  } else {
    startY = randomRange(200, 250);
  }

  const hasNearbyObstacle = state.obstacles.some(obs => {
    const obsCenterY = obs.y + obs.height / 2;
    return Math.abs(startY - obsCenterY) < FLYING_OBSTACLE_SAFE_DISTANCE;
  });

  if (hasNearbyObstacle) return;

  const velocityX = -(FLYING_OBSTACLE_BASE_SPEED * speedMultiplier);
  const verticalDrift = (Math.random() * 2 - 1);
  const rotation = verticalDrift * 0.15;

  state.flyingObstacles.push({
    x: spawnX,
    y: startY,
    width: FLYING_OBSTACLE_WIDTH,
    height: FLYING_OBSTACLE_HEIGHT,
    velocityX,
    verticalDrift: verticalDrift * speedMultiplier,
    rotation,
    wingPhase: Math.random() * Math.PI * 2,
  });
  console.log(`[SPAWN] Bird at x=${spawnX}, y=${startY}`);
}

function spawnCoin(state: GameState, level: typeof levels[0]): void {
  // FIX #7: Check if previous coin is still on screen
  const lastCoin = state.coins[state.coins.length - 1];
  if (lastCoin && lastCoin.x > CANVAS_WIDTH - 150) {
    return; // Don't spawn if last coin is too close
  }

  const isHigh = Math.random() < 0.2;
  const y = isHigh
    ? randomRange(40, GROUND_Y - 200)
    : randomRange(GROUND_Y - 150, GROUND_Y - 20);

  state.coins.push({
    x: CANVAS_WIDTH + 20,
    y,
    radius: isHigh ? 14 : 12,
    type: isHigh ? 'high' : 'normal',
    sparklePhase: Math.random() * Math.PI * 2,
  });
  console.log(`[SPAWN] Coin at y=${y}, type=${isHigh ? 'high' : 'normal'}`);
}

function spawnShrinker(state: GameState, level: typeof levels[0]): void {
  // FIX #8: Level 3 has fewer shrinkers
  if (level.id === 3 && Math.random() < 0.5) return;

  const y = randomRange(GROUND_Y - 180, GROUND_Y - 60);
  state.shrinkers.push({ x: CANVAS_WIDTH + 20, y, radius: 15 });
  console.log(`[SPAWN] Shrinker at y=${y}`);
}

function spawnIceShield(state: GameState): void {
  if (state.iceShieldActive) return;

  const y = randomRange(GROUND_Y - 180, GROUND_Y - 80);
  state.coins.push({
    x: CANVAS_WIDTH + 20,
    y,
    radius: 16,
    type: 'iceShield',
    sparklePhase: 0,
  });
  console.log(`[SPAWN] Ice Shield at y=${y}`);
}

function spawnPlatform(state: GameState): void {
  // FIX #1: 5 different heights
  const tier = Math.random();
  let y: number;
  let width: number;

  if (tier < 0.20) {
    y = GROUND_Y - 40; // Very low
    width = randomRange(70, 120);
  } else if (tier < 0.40) {
    y = GROUND_Y - 90; // Low
    width = randomRange(70, 120);
  } else if (tier < 0.60) {
    y = GROUND_Y - 160; // Medium
    width = randomRange(70, 120);
  } else if (tier < 0.80) {
    y = GROUND_Y - 230; // High
    width = randomRange(70, 120);
  } else {
    y = GROUND_Y - 300; // Very high
    width = randomRange(70, 120);
  }

  // FIX #1: 30% wide platforms
  if (Math.random() < 0.30) {
    width = randomRange(150, 200);
  }

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
  console.log(`[SPAWN] Platform at y=${y}, width=${width}`);
}

function spawnDoubleJumpPowerUp(state: GameState): void {
  if (state.survivalTime < DOUBLE_JUMP_FIRST_DELAY) return;
  if (state.doubleJumpActive) return;

  const y = randomRange(GROUND_Y - 180, GROUND_Y - 80);
  state.coins.push({
    x: CANVAS_WIDTH + 20,
    y,
    radius: 16,
    type: 'doubleJump',
    sparklePhase: 0,
  });
  console.log(`[SPAWN] Double Jump at y=${y}`);
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

function addIceShards(state: GameState, x: number, y: number): void {
  for (let i = 0; i < 15; i++) {
    const angle = (Math.PI * 2 / 15) * i + Math.random() * 0.3;
    const speed = randomRange(3, 7);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      radius: randomRange(3, 6),
      color: i % 2 === 0 ? '#67e8f9' : '#a5f3fc',
      alpha: 1.0,
      life: randomRange(30, 50),
    });
  }
}

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

function handleObstacleHit(state: GameState, obsX: number, obsY: number): void {
  if (state.iceShieldActive) {
    state.iceShieldActive = false;
    state.iceShieldTimer = 0;
    
    addIceShards(state, HERO_X, state.heroY);
    addFloatingText(state, HERO_X, state.heroY - state.heroRadius - 20, 'Shield Broken!', '#06b6d4');
    
    return;
  }

  // FIX #2: Hero grows on hit
  state.heroRadius *= 1.50;
  if (state.heroRadius > state.maxRadiusReached) {
    state.maxRadiusReached = state.heroRadius;
  }

  state.flashTimer = 15;
  state.squishTimer = 12;
  state.screenShakeTimer = SCREEN_SHAKE_DURATION;
  state.invincibilityTimer = INVINCIBILITY_DURATION;
  state.hitAnimationTimer = HIT_ANIMATION_DURATION;

  addParticles(state, obsX, obsY, '#ff4444', 8);
  addFloatingText(state, HERO_X, state.heroY - state.heroRadius - 15, 'Ouch!', '#ef4444');

  if (state.heroRadius >= MAX_RADIUS) {
    state.isGameOver = true;
    if (state.score > state.highScore) {
      state.highScore = state.score;
      state.isNewRecord = true;
      localStorage.setItem(HIGH_SCORE_KEY, state.score.toString());
    }
  }
}

function checkCollisions(state: GameState): void {
  const heroR = state.heroRadius * HITBOX_SHRINK;

  if (state.invincibilityTimer <= 0) {
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obs = state.obstacles[i];
      if (circleRectCollision(HERO_X, state.heroY, heroR, obs.x, obs.y, obs.width, obs.height)) {
        handleObstacleHit(state, obs.x + obs.width / 2, obs.y + obs.height / 2);
        state.obstacles.splice(i, 1);
        break;
      }
    }
  }

  if (state.invincibilityTimer <= 0) {
    for (let i = state.flyingObstacles.length - 1; i >= 0; i--) {
      const bird = state.flyingObstacles[i];
      if (circleCircleCollision(HERO_X, state.heroY, heroR, bird.x, bird.y, FLYING_OBSTACLE_HITBOX / 2)) {
        handleObstacleHit(state, bird.x, bird.y);
        state.flyingObstacles.splice(i, 1);
        break;
      }
    }
  }

  for (let i = state.coins.length - 1; i >= 0; i--) {
    const coin = state.coins[i];
    if (circleCircleCollision(HERO_X, state.heroY, heroR, coin.x, coin.y, coin.radius * HITBOX_SHRINK)) {
      if (coin.type === 'doubleJump') {
        state.doubleJumpActive = true;
        state.doubleJumpTimer = DOUBLE_JUMP_DURATION;
        state.hasDoubleJumped = false;
        state.doubleJumpReadyTimer = 120;
        addFloatingText(state, coin.x, coin.y - 20, '2x JUMP!', '#a855f7');
        addParticles(state, coin.x, coin.y, '#c084fc', 12);
      } else if (coin.type === 'iceShield') {
        state.iceShieldActive = true;
        state.iceShieldTimer = ICE_SHIELD_DURATION;
        addFloatingText(state, coin.x, coin.y - 20, 'SHIELD!', '#06b6d4');
        addParticles(state, coin.x, coin.y, '#67e8f9', 10);
      } else if (coin.type === 'high') {
        state.score += 25;
        addFloatingText(state, coin.x, coin.y - 20, '+25', '#fbbf24');
        addParticles(state, coin.x, coin.y, '#fcd34d', 10);
      } else {
        state.score += 10;
        addFloatingText(state, coin.x, coin.y - 20, '+10', '#f59e0b');
        addParticles(state, coin.x, coin.y, '#fbbf24', 6);
      }
      state.coins.splice(i, 1);
    }
  }

  // FIX #5: Shrinker collection without collision effect
  for (let i = state.shrinkers.length - 1; i >= 0; i--) {
    const shrinker = state.shrinkers[i];
    if (circleCircleCollision(HERO_X, state.heroY, heroR, shrinker.x, shrinker.y, shrinker.radius * HITBOX_SHRINK)) {
      // Just shrink, no hit animation
      state.heroRadius *= 0.8;
      if (state.heroRadius < INITIAL_RADIUS) state.heroRadius = INITIAL_RADIUS;
      state.score += 5;
      
      // Positive effects only
      addFloatingText(state, shrinker.x, shrinker.y - 20, '+5', '#10b981');
      addParticles(state, shrinker.x, shrinker.y, '#34d399', 10);
      
      // NO screen shake, NO invincibility, NO hit animation
      state.shrinkers.splice(i, 1);
    }
  }
}

// ==================== PLATFORM COLLISION ====================

function checkPlatformLanding(state: GameState): Platform | null {
  if (state.velocityY <= 0) return null;

  const heroBottom = state.heroY + state.heroRadius;
  const heroPrevBottom = heroBottom - state.velocityY;

  for (const platform of state.platforms) {
    if (platform.breaking && platform.crackLevel >= 3) continue;

    const heroLeft = HERO_X - state.heroRadius * 0.6;
    const heroRight = HERO_X + state.heroRadius * 0.6;
    const platLeft = platform.x;
    const platRight = platform.x + platform.width;

    if (heroRight > platLeft && heroLeft < platRight) {
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
  const [currentScreen, setCurrentScreen] = useState<GameScreen>('MENU');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [levelBestScores, setLevelBestScores] = useState<Record<number, number>>({});
  const [levelStars, setLevelStars] = useState(0);

  const handleJump = useCallback(() => {
    const state = stateRef.current;
    if (state.isGameOver || state.isPaused) return;

    if (state.isGrounded || state.onPlatform) {
      state.velocityY = JUMP_FORCE;
      state.isGrounded = false;
      state.onPlatform = null;
      state.hasDoubleJumped = false;
    } else if (state.doubleJumpActive && !state.hasDoubleJumped) {
      state.velocityY = DOUBLE_JUMP_FORCE;
      state.hasDoubleJumped = true;
      addParticles(state, HERO_X, state.heroY, '#c084fc', 8);
    }
  }, []);

  const handleRestart = useCallback(() => {
    stateRef.current = createInitialState();
    setCurrentScreen('PLAYING');
  }, []);

  const togglePause = useCallback(() => {
    const state = stateRef.current;
    if (state.isGameOver) return;
    state.isPaused = !state.isPaused;
    if (state.isPaused) {
      setCurrentScreen('PAUSED');
    } else {
      setCurrentScreen('PLAYING');
    }
  }, []);

  const startLevel = useCallback((levelId: number) => {
    stateRef.current = createInitialState();
    setCurrentLevel(levelId);
    setCurrentScreen('PLAYING');
  }, []);

  const goToMenu = useCallback(() => {
    setCurrentScreen('MENU');
  }, []);

  // ==================== UPDATE ====================
  const update = useCallback((state: GameState, level: typeof levels[0]) => {
    if (state.isGameOver || state.isPaused) return;

    state.frameCount++;
    state.survivalTime++;
    state.levelTime++;

    // Check level completion
    if (state.levelTime >= level.targetTime * 60) {
      state.isGameOver = false;
      state.isPaused = true;
      
      // Calculate stars
      const timeBonus = Math.max(0, level.targetTime * 60 - state.levelTime);
      const stars = state.score > 1000 ? 3 : state.score > 500 ? 2 : 1;
      setLevelStars(stars);
      
      // Save best score
      const currentBest = levelBestScores[level.id] || 0;
      if (state.score > currentBest) {
        setLevelBestScores(prev => ({ ...prev, [level.id]: state.score }));
      }
      
      setCurrentScreen('LEVEL_COMPLETE');
      return;
    }

    state.velocityY += GRAVITY;
    state.heroY += state.velocityY;

    const landedPlatform = checkPlatformLanding(state);
    if (landedPlatform) {
      state.heroY = landedPlatform.y - state.heroRadius;
      state.velocityY = 0;
      state.isGrounded = false;
      state.onPlatform = landedPlatform;
      state.hasDoubleJumped = false;
    }

    if (state.onPlatform) {
      const heroLeft = HERO_X - state.heroRadius * 0.6;
      const heroRight = HERO_X + state.heroRadius * 0.6;
      const plat = state.onPlatform;
      const platLeft = plat.x;
      const platRight = plat.x + plat.width;

      if (heroRight > platLeft && heroLeft < platRight) {
        plat.standTimer++;
        if (plat.standTimer >= PLATFORM_BREAK_TIME) {
          plat.crackLevel = 3;
        } else if (plat.standTimer >= PLATFORM_CRACK_START) {
          plat.crackLevel = Math.floor((plat.standTimer - PLATFORM_CRACK_START) / ((PLATFORM_BREAK_TIME - PLATFORM_CRACK_START) / 3)) + 1;
          plat.breaking = true;
        }
      } else {
        state.onPlatform = null;
      }
    }

    if (state.heroY >= GROUND_Y - state.heroRadius) {
      state.heroY = GROUND_Y - state.heroRadius;
      state.velocityY = 0;
      state.isGrounded = true;
      state.onPlatform = null;
      state.hasDoubleJumped = false;
    }

    if (state.onPlatform && state.velocityY > 0) {
      const heroBottom = state.heroY + state.heroRadius;
      if (heroBottom > state.onPlatform.y + 20) {
        state.onPlatform = null;
      }
    }

    if (state.doubleJumpActive) {
      state.doubleJumpTimer--;
      if (state.doubleJumpTimer <= 0) {
        state.doubleJumpActive = false;
        state.hasDoubleJumped = false;
      }
    }
    if (state.doubleJumpReadyTimer > 0) state.doubleJumpReadyTimer--;

    if (state.iceShieldActive) {
      state.iceShieldTimer--;
      if (state.iceShieldTimer <= 0) {
        state.iceShieldActive = false;
      }
    }

    state.scrollOffset += state.scrollSpeed;
    if (state.scrollOffset >= LINE_SPACING) {
      state.scrollOffset -= LINE_SPACING;
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      state.obstacles[i].x -= state.scrollSpeed;
      if (state.obstacles[i].x + state.obstacles[i].width < -50) state.obstacles.splice(i, 1);
    }

    for (let i = state.flyingObstacles.length - 1; i >= 0; i--) {
      const bird = state.flyingObstacles[i];
      bird.x += bird.velocityX;
      bird.y += bird.verticalDrift;
      bird.wingPhase += 0.2;

      if (bird.x < -50 || bird.y > CANVAS_HEIGHT || bird.y < -100) {
        state.flyingObstacles.splice(i, 1);
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

    for (let i = state.platforms.length - 1; i >= 0; i--) {
      const plat = state.platforms[i];
      plat.x -= state.scrollSpeed;

      if (plat.x + plat.width < -50 || plat.crackLevel >= 3) {
        if (state.onPlatform === plat) {
          state.onPlatform = null;
        }
        if (plat.crackLevel >= 3) {
          addParticles(state, plat.x + plat.width / 2, plat.y, '#92400e', 6);
        }
        state.platforms.splice(i, 1);
      }
    }

    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const ft = state.floatingTexts[i];
      ft.y += ft.velocityY;
      ft.alpha -= 0.015;
      if (ft.alpha <= 0) state.floatingTexts.splice(i, 1);
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
      p.alpha = p.life / 40;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    for (let i = state.speedLines.length - 1; i >= 0; i--) {
      const sl = state.speedLines[i];
      sl.x -= sl.speed;
      sl.alpha -= 0.02;
      if (sl.x + sl.length < 0 || sl.alpha <= 0) state.speedLines.splice(i, 1);
    }

    if (state.frameCount % Math.max(2, Math.floor(10 - state.scrollSpeed)) === 0) {
      addSpeedLine(state);
    }

    if (state.flashTimer > 0) state.flashTimer--;
    if (state.invincibilityTimer > 0) state.invincibilityTimer--;
    if (state.hitAnimationTimer > 0) state.hitAnimationTimer--;

    if (state.screenShakeTimer > 0) {
      state.screenShakeTimer--;
      state.screenShakeX = (Math.random() - 0.5) * 5;
      state.screenShakeY = (Math.random() - 0.5) * 5;
    } else {
      state.screenShakeX = 0;
      state.screenShakeY = 0;
    }

    if (state.squishTimer > 0) {
      state.squishTimer--;
      const progress = state.squishTimer / 12;
      state.squishScaleX = 1 + progress * 0.3;
      state.squishScaleY = 1 - progress * 0.2;
    } else {
      state.squishScaleX = 1;
      state.squishScaleY = 1;
    }

    // Speed increase
    state.speedTimer++;
    if (state.speedTimer >= 180) {
      state.speedTimer = 0;
      const maxSpeed = state.baseSpeed * level.maxSpeedMultiplier;
      if (state.scrollSpeed < maxSpeed) {
        state.scrollSpeed *= (1 + level.speedGrowthRate);
        if (state.scrollSpeed > maxSpeed) state.scrollSpeed = maxSpeed;
      }
    }

    state.spawnRateTimer++;
    if (state.spawnRateTimer >= 300) {
      state.spawnRateTimer = 0;
      state.minObstacleInterval = Math.max(36, state.minObstacleInterval - 6);
    }

    // Spawn timers with level frequencies
    state.obstacleTimer++;
    if (state.obstacleTimer >= state.obstacleInterval / level.obstacleFrequency) {
      state.obstacleTimer = 0;
      spawnObstacle(state, level);
      state.obstacleInterval = randomRange(state.minObstacleInterval, state.minObstacleInterval + 60);
    }

    state.flyingObstacleTimer++;
    const speedMultiplier = state.scrollSpeed / state.baseSpeed;
    const flyingIntervalAdjusted = Math.max(
      120,
      Math.floor(state.flyingObstacleInterval / (1 + speedMultiplier * 0.15)) / level.birdFrequency
    );
    if (state.flyingObstacleTimer >= flyingIntervalAdjusted) {
      state.flyingObstacleTimer = 0;
      spawnFlyingObstacle(state);
      state.flyingObstacleInterval = randomRange(FLYING_OBSTACLE_SPAWN_MIN, FLYING_OBSTACLE_SPAWN_MAX);
    }

    state.coinTimer++;
    const coinBaseInterval = 120 + Math.floor(state.survivalTime / 1800) * 5;
    if (state.coinTimer >= state.coinInterval / level.coinMultiplier) {
      state.coinTimer = 0;
      spawnCoin(state, level);
      state.coinInterval = randomRange(coinBaseInterval, coinBaseInterval + 45);
    }

    state.shrinkerTimer++;
    const shrinkerReduction = Math.min(120, Math.floor(state.survivalTime / 1800) * 15);
    if (state.shrinkerTimer >= state.shrinkerInterval) {
      state.shrinkerTimer = 0;
      spawnShrinker(state, level);
      state.shrinkerInterval = randomRange(
        Math.max(300, 480 - shrinkerReduction),
        Math.max(420, 720 - shrinkerReduction)
      );
    }

    state.platformTimer++;
    const platformIntervalAdjusted = Math.max(60, state.platformInterval - Math.floor(state.scrollSpeed * 5));
    if (state.platformTimer >= platformIntervalAdjusted / level.platformFrequency) {
      state.platformTimer = 0;
      spawnPlatform(state);
      state.platformInterval = randomRange(60, 120);
    }

    state.doubleJumpSpawnTimer++;
    const djInterval = randomRange(DOUBLE_JUMP_SPAWN_MIN, DOUBLE_JUMP_SPAWN_MAX);
    if (state.doubleJumpSpawnTimer >= djInterval) {
      state.doubleJumpSpawnTimer = 0;
      spawnDoubleJumpPowerUp(state);
    }

    state.iceShieldSpawnTimer++;
    const iceInterval = randomRange(ICE_SHIELD_SPAWN_MIN, ICE_SHIELD_SPAWN_MAX);
    if (state.iceShieldSpawnTimer >= iceInterval) {
      state.iceShieldSpawnTimer = 0;
      spawnIceShield(state);
    }

    checkCollisions(state);
  }, [levelBestScores]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, state: GameState, level: typeof levels[0]) => {
    ctx.save();

    if (state.screenShakeTimer > 0) {
      ctx.translate(state.screenShakeX, state.screenShakeY);
    }

    // Background
    ctx.fillStyle = level.background;
    ctx.fillRect(-5, -5, CANVAS_WIDTH + 10, CANVAS_HEIGHT + 10);

    // Scrolling lines
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

    // Speed lines
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

    // Ground
    ctx.fillStyle = level.groundColor;
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    // Platforms
    for (const plat of state.platforms) {
      if (plat.crackLevel >= 3) continue;

      let drawX = plat.x;
      let drawY = plat.y;
      if (plat.breaking) {
        drawX += (Math.random() - 0.5) * plat.crackLevel * 2;
        drawY += (Math.random() - 0.5) * plat.crackLevel;
      }

      ctx.fillStyle = '#92400e';
      ctx.fillRect(drawX, drawY, plat.width, plat.height);

      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1;
      for (let g = 0; g < 3; g++) {
        const gy = drawY + 3 + g * 4;
        ctx.beginPath();
        ctx.moveTo(drawX + 2, gy);
        ctx.lineTo(drawX + plat.width - 2, gy);
        ctx.stroke();
      }

      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, plat.width, plat.height);

      ctx.fillStyle = '#b45309';
      ctx.fillRect(drawX, drawY, plat.width, 3);

      if (plat.crackLevel >= 1) {
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(drawX + plat.width * 0.3, drawY);
        ctx.lineTo(drawX + plat.width * 0.35, drawY + plat.height * 0.5);
        ctx.lineTo(drawX + plat.width * 0.28, drawY + plat.height);
        ctx.stroke();
      }
    }

    // Obstacles
    for (const obs of state.obstacles) {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      
      if (obs.type === 'spiked') {
        ctx.fillStyle = '#ef4444';
        for (let i = 0; i < obs.width; i += 8) {
          ctx.beginPath();
          ctx.moveTo(obs.x + i, obs.y);
          ctx.lineTo(obs.x + i + 4, obs.y - 8);
          ctx.lineTo(obs.x + i + 8, obs.y);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y);
        ctx.lineTo(obs.x + obs.width / 2, obs.y - 10);
        ctx.lineTo(obs.x + obs.width, obs.y);
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 2;
      ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    }

    // Flying obstacles
    for (const bird of state.flyingObstacles) {
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(bird.rotation);

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-bird.width / 2, 0);
      ctx.lineTo(0, -bird.height / 2);
      ctx.lineTo(bird.width / 2, 0);
      ctx.lineTo(0, bird.height / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 2;
      ctx.stroke();

      const wingOffset = Math.sin(bird.wingPhase) * bird.height * 0.4;
      ctx.fillStyle = '#ef4444';
      
      ctx.beginPath();
      ctx.moveTo(-bird.width * 0.2, -bird.height * 0.1);
      ctx.lineTo(0, -bird.height * 0.5 - wingOffset);
      ctx.lineTo(bird.width * 0.2, -bird.height * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-bird.width * 0.2, bird.height * 0.1);
      ctx.lineTo(0, bird.height * 0.5 + wingOffset);
      ctx.lineTo(bird.width * 0.2, bird.height * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // Coins
    for (const coin of state.coins) {
      if (coin.type === 'doubleJump') {
        const pulse = Math.sin(state.frameCount * 0.15) * 3 + 3;
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius + pulse + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#a855f7';
        ctx.fill();
        ctx.strokeStyle = '#7c3aed';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('2x', coin.x, coin.y);
      } else if (coin.type === 'iceShield') {
        const pulse = Math.sin(state.frameCount * 0.12) * 3 + 3;
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius + pulse + 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(103, 232, 249, 0.25)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#06b6d4';
        ctx.fill();
        ctx.strokeStyle = '#0891b2';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (coin.type === 'high') {
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#92400e';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', coin.x, coin.y + 1);
      } else {
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

    // Shrinkers
    for (const shrinker of state.shrinkers) {
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

    // Particles
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Hero
    ctx.save();
    ctx.translate(HERO_X, state.heroY);
    ctx.scale(state.squishScaleX, state.squishScaleY);

    if (state.iceShieldActive) {
      const shieldPulse = Math.sin(state.frameCount * 0.12) * 4 + 8;
      const shieldAlpha = 0.25 + Math.sin(state.frameCount * 0.1) * 0.1;
      ctx.beginPath();
      ctx.arc(0, 0, state.heroRadius + shieldPulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(103, 232, 249, ${shieldAlpha})`;
      ctx.fill();
    }

    if (state.doubleJumpActive) {
      const auraPulse = Math.sin(state.frameCount * 0.1) * 5 + 10;
      const auraAlpha = 0.2 + Math.sin(state.frameCount * 0.08) * 0.1;
      ctx.beginPath();
      ctx.arc(0, 0, state.heroRadius + auraPulse + (state.iceShieldActive ? 12 : 0), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(168, 85, 247, ${auraAlpha})`;
      ctx.fill();
    }

    const isInvincibleVisible = state.invincibilityTimer <= 0 || Math.floor(state.invincibilityTimer / 3) % 2 === 0;

    if (isInvincibleVisible) {
      // FIX #2: Keep hero blue, no color change on hit
      ctx.beginPath();
      ctx.arc(0, 0, state.heroRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-state.heroRadius * 0.25, -state.heroRadius * 0.25, state.heroRadius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fill();

      if (state.hitAnimationTimer > 0) {
        // "Ouch!" face
        const r = state.heroRadius;
        const eyeY = -r * 0.15;
        const eyeSize = r * 0.2;

        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = Math.max(2, r * 0.08);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.35 - eyeSize, eyeY - eyeSize * 0.7);
        ctx.lineTo(-r * 0.35, eyeY);
        ctx.lineTo(-r * 0.35 - eyeSize, eyeY + eyeSize * 0.7);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(r * 0.35 + eyeSize, eyeY - eyeSize * 0.7);
        ctx.lineTo(r * 0.35, eyeY);
        ctx.lineTo(r * 0.35 + eyeSize, eyeY + eyeSize * 0.7);
        ctx.stroke();

        const mouthY = r * 0.25;
        const mouthW = r * 0.2;
        const mouthH = r * 0.25;
        ctx.beginPath();
        ctx.ellipse(0, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();

        ctx.lineCap = 'butt';
      } else {
        // Normal face
        const eyeOffset = state.heroRadius * 0.3;
        ctx.beginPath();
        ctx.arc(eyeOffset, -eyeOffset * 0.5, state.heroRadius * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eyeOffset + 2, -eyeOffset * 0.5, state.heroRadius * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();

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

    // Floating texts
    for (const ft of state.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    // UI
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${state.score}`, 15, 12);

    ctx.fillStyle = '#6b7280';
    ctx.font = '14px Arial';
    ctx.fillText(`Best: ${state.highScore}`, 15, 36);

    ctx.fillStyle = '#4b5563';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${formatTime(state.levelTime)}`, CANVAS_WIDTH / 2, 36);

    const speedMultiplier = (state.scrollSpeed / state.baseSpeed).toFixed(1);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`⚡ Speed: x${speedMultiplier}`, CANVAS_WIDTH / 2, 52);

    if (state.doubleJumpActive) {
      const djSecondsLeft = Math.ceil(state.doubleJumpTimer / 60);
      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`2x JUMP: ${djSecondsLeft}s`, CANVAS_WIDTH / 2, 68);
    }

    if (state.iceShieldActive) {
      const shieldSecondsLeft = Math.ceil(state.iceShieldTimer / 60);
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`🛡️ SHIELD: ${shieldSecondsLeft}s`, 15, 54);
    }

    const sizePercent = Math.round((state.heroRadius / MAX_RADIUS) * 100);
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Size: ${sizePercent}%`, CANVAS_WIDTH - 15, 12);

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

    ctx.restore();
  }, []);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;
    const level = levels[currentLevel - 1];

    update(state, level);
    draw(ctx, state, level);

    if (state.isPaused || state.isGameOver) {
      state.frameCount++;
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw, currentLevel]);

  useEffect(() => {
    if (currentScreen === 'PLAYING') {
      animFrameRef.current = requestAnimationFrame(gameLoop);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (state.isGameOver) {
          handleRestart();
        } else if (!state.isPaused && currentScreen === 'PLAYING') {
          handleJump();
        }
      }

      if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P' || e.code === 'Escape') {
        if (currentScreen === 'PLAYING' || currentScreen === 'PAUSED') {
          togglePause();
        }
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
        } else if (!state.isPaused && currentScreen === 'PLAYING') {
          handleJump();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [gameLoop, handleJump, handleRestart, togglePause, currentScreen]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 select-none">
      <h1 className="text-3xl font-bold text-white mb-2">
        🏃 Hero Runner - Level {currentLevel}: {levels[currentLevel - 1].name}
      </h1>

      {currentScreen === 'MENU' && (
        <div className="text-center">
          <h2 className="text-4xl font-bold text-white mb-8">Select Level</h2>
          <div className="grid grid-cols-1 gap-4">
            {levels.map((level) => (
              <button
                key={level.id}
                onClick={() => startLevel(level.id)}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg text-xl font-bold hover:bg-blue-700"
              >
                Level {level.id}: {level.name}
                <div className="text-sm font-normal mt-1">
                  Target: {level.targetTime}s | Max Speed: x{level.maxSpeedMultiplier}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {(currentScreen === 'PLAYING' || currentScreen === 'PAUSED') && (
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-2 border-gray-600 rounded-lg shadow-2xl cursor-pointer max-w-full"
        />
      )}

      {currentScreen === 'PAUSED' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center">
          <h2 className="text-5xl font-bold text-white mb-4">⏸ PAUSED</h2>
          <button
            onClick={togglePause}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg text-xl font-bold hover:bg-blue-700 mb-4"
          >
            Resume
          </button>
          <button
            onClick={goToMenu}
            className="px-8 py-3 bg-gray-600 text-white rounded-lg text-xl font-bold hover:bg-gray-700"
          >
            Main Menu
          </button>
        </div>
      )}

      {currentScreen === 'LEVEL_COMPLETE' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center">
          <h2 className="text-5xl font-bold text-green-400 mb-4">✅ LEVEL COMPLETE!</h2>
          <div className="text-6xl text-yellow-400 mb-4">
            {'★'.repeat(levelStars)}{'☆'.repeat(3 - levelStars)}
          </div>
          <div className="text-white text-2xl mb-2">
            Score: {stateRef.current.score}
          </div>
          <div className="text-gray-400 text-xl mb-8">
            Best: {levelBestScores[currentLevel] || stateRef.current.score}
          </div>
          {currentLevel < 5 && (
            <button
              onClick={() => startLevel(currentLevel + 1)}
              className="px-8 py-3 bg-green-600 text-white rounded-lg text-xl font-bold hover:bg-green-700 mb-4"
            >
              Next Level
            </button>
          )}
          <button
            onClick={goToMenu}
            className="px-8 py-3 bg-gray-600 text-white rounded-lg text-xl font-bold hover:bg-gray-700"
          >
            Main Menu
          </button>
        </div>
      )}

      {currentScreen === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center">
          <h2 className="text-5xl font-bold text-red-500 mb-4">💀 GAME OVER</h2>
          <div className="text-white text-2xl mb-2">
            Final Score: {stateRef.current.score}
          </div>
          <div className="text-gray-400 text-xl mb-2">
            Best Score: {stateRef.current.highScore}
          </div>
          {stateRef.current.isNewRecord && (
            <div className="text-yellow-400 text-2xl font-bold mb-4 animate-pulse">
              🏆 NEW RECORD! 🏆
            </div>
          )}
          <button
            onClick={handleRestart}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg text-xl font-bold hover:bg-blue-700 mb-4"
          >
            Retry Level
          </button>
          <button
            onClick={goToMenu}
            className="px-8 py-3 bg-gray-600 text-white rounded-lg text-xl font-bold hover:bg-gray-700"
          >
            Main Menu
          </button>
        </div>
      )}

      {currentScreen === 'PLAYING' && (
        <div className="mt-4 flex flex-wrap gap-3 justify-center text-xs text-gray-500">
          <span>🟥 Obstacles = Grow</span>
          <span>🔴 Birds = Fly & Grow</span>
          <span>🟢 Green = Shrink +5</span>
          <span>🟡 Coins = +10</span>
          <span>⭐ Gold = +25</span>
          <span>🟣 Purple = Double Jump</span>
          <span>🔵 Blue = Ice Shield (1 hit)</span>
          <span>🟫 Platforms = Jump higher</span>
        </div>
      )}
    </div>
  );
}

export default App;
