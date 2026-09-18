import { useEffect, useRef, useCallback } from 'react';

/**
 * Hero Runner - HTML5 Canvas Game
 * 
 * Mechanics:
 * - Blue circle hero with gravity & jump (Space/Click)
 * - Red obstacles: hero grows +15% on collision
 * - Green shrinkers: hero shrinks -20%, +5 score
 * - Yellow coins: +10 score with floating text
 * - Game Over when radius >= 120px
 * - Difficulty scales over time
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
const MAX_RADIUS = 120; // Game over threshold
const HITBOX_SHRINK = 0.9; // 10% smaller hitbox for forgiveness

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

  // Entities
  obstacles: Obstacle[];
  coins: Coin[];
  shrinkers: Shrinker[];
  floatingTexts: FloatingText[];
  particles: Particle[];

  // Score
  score: number;

  // Timers (in frames)
  obstacleTimer: number;
  obstacleInterval: number;
  coinTimer: number;
  coinInterval: number;
  shrinkerTimer: number;
  shrinkerInterval: number;
  difficultyTimer: number;

  // Visual effects
  flashTimer: number;
  squishTimer: number;
  squishScaleX: number;
  squishScaleY: number;

  // Game state
  isGameOver: boolean;
  frameCount: number;
}

// ==================== HELPER FUNCTIONS ====================

/** Create initial game state */
function createInitialState(): GameState {
  return {
    heroY: GROUND_Y - INITIAL_RADIUS,
    velocityY: 0,
    isGrounded: true,
    heroRadius: INITIAL_RADIUS,
    maxRadiusReached: INITIAL_RADIUS,

    scrollOffset: 0,
    scrollSpeed: BASE_SCROLL_SPEED,

    obstacles: [],
    coins: [],
    shrinkers: [],
    floatingTexts: [],
    particles: [],

    score: 0,

    obstacleTimer: 0,
    obstacleInterval: randomRange(90, 180), // 1.5-3 seconds at 60fps
    coinTimer: 0,
    coinInterval: randomRange(60, 120),
    shrinkerTimer: 0,
    shrinkerInterval: randomRange(480, 720), // 8-12 seconds

    difficultyTimer: 0,

    flashTimer: 0,
    squishTimer: 0,
    squishScaleX: 1,
    squishScaleY: 1,

    isGameOver: false,
    frameCount: 0,
  };
}

/** Random number between min and max */
function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Circle-Rectangle collision detection */
function circleRectCollision(
  cx: number, cy: number, cr: number,
  rx: number, ry: number, rw: number, rh: number
): boolean {
  // Find closest point on rectangle to circle center
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));

  // Calculate distance
  const dx = cx - closestX;
  const dy = cy - closestY;

  return (dx * dx + dy * dy) < (cr * cr);
}

/** Circle-Circle collision detection */
function circleCircleCollision(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (r1 + r2);
}

// ==================== SPAWN FUNCTIONS ====================

/** Spawn a red obstacle from the right */
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

/** Spawn a yellow coin at various heights */
function spawnCoin(state: GameState): void {
  // Some coins on ground level, some in the air
  const isAirborne = Math.random() > 0.4;
  const y = isAirborne
    ? randomRange(GROUND_Y - 150, GROUND_Y - 80) // Air coins (need jump)
    : GROUND_Y - 20; // Ground coins

  state.coins.push({
    x: CANVAS_WIDTH + 20,
    y: y,
    radius: 12,
    collected: false,
  });
}

/** Spawn a green shrinker (rare power-up) */
function spawnShrinker(state: GameState): void {
  const y = randomRange(GROUND_Y - 180, GROUND_Y - 60);

  state.shrinkers.push({
    x: CANVAS_WIDTH + 20,
    y: y,
    radius: 15,
    collected: false,
  });
}

/** Create floating text animation */
function addFloatingText(state: GameState, x: number, y: number, text: string, color: string): void {
  state.floatingTexts.push({
    x, y, text, color,
    alpha: 1.0,
    velocityY: -2,
  });
}

/** Create particle burst effect */
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
  const heroR = state.heroRadius * HITBOX_SHRINK; // Forgiving hitbox

  // Check obstacle collisions (circle-rectangle)
  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const obs = state.obstacles[i];
    if (circleRectCollision(
      HERO_X, state.heroY, heroR,
      obs.x, obs.y, obs.width, obs.height
    )) {
      // Hero hits obstacle: grows 15%, obstacle disappears
      state.heroRadius *= 1.15;
      if (state.heroRadius > state.maxRadiusReached) {
        state.maxRadiusReached = state.heroRadius;
      }

      // Visual effects
      state.flashTimer = 15; // Red flash frames
      state.squishTimer = 12; // Squish animation frames

      // Particles
      addParticles(state, obs.x + obs.width / 2, obs.y + obs.height / 2, '#ff4444', 8);

      // Remove obstacle
      state.obstacles.splice(i, 1);

      // Check game over
      if (state.heroRadius >= MAX_RADIUS) {
        state.isGameOver = true;
      }
    }
  }

  // Check coin collisions (circle-circle)
  for (let i = state.coins.length - 1; i >= 0; i--) {
    const coin = state.coins[i];
    if (!coin.collected && circleCircleCollision(
      HERO_X, state.heroY, heroR,
      coin.x, coin.y, coin.radius * HITBOX_SHRINK
    )) {
      coin.collected = true;
      state.score += 10;

      // Floating text
      addFloatingText(state, coin.x, coin.y - 20, '+10', '#f59e0b');

      // Gold particles
      addParticles(state, coin.x, coin.y, '#fbbf24', 6);

      state.coins.splice(i, 1);
    }
  }

  // Check shrinker collisions (circle-circle)
  for (let i = state.shrinkers.length - 1; i >= 0; i--) {
    const shrinker = state.shrinkers[i];
    if (!shrinker.collected && circleCircleCollision(
      HERO_X, state.heroY, heroR,
      shrinker.x, shrinker.y, shrinker.radius * HITBOX_SHRINK
    )) {
      shrinker.collected = true;

      // Shrink hero by 20%, but not below initial size
      state.heroRadius *= 0.8;
      if (state.heroRadius < INITIAL_RADIUS) {
        state.heroRadius = INITIAL_RADIUS;
      }

      state.score += 5;

      // Floating text
      addFloatingText(state, shrinker.x, shrinker.y - 20, '+5', '#10b981');

      // Green sparkle particles
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

  // ==================== JUMP HANDLER ====================
  const handleJump = useCallback(() => {
    const state = stateRef.current;
    if (state.isGameOver) return;
    if (state.isGrounded) {
      state.velocityY = JUMP_FORCE;
      state.isGrounded = false;
    }
  }, []);

  // ==================== RESTART HANDLER ====================
  const handleRestart = useCallback(() => {
    stateRef.current = createInitialState();
  }, []);

  // ==================== UPDATE FUNCTION ====================
  const update = useCallback((state: GameState) => {
    if (state.isGameOver) return;

    state.frameCount++;

    // --- Hero Physics ---
    state.velocityY += GRAVITY;
    state.heroY += state.velocityY;

    // Ground collision
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

    // --- Move Obstacles ---
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      state.obstacles[i].x -= state.scrollSpeed;
      if (state.obstacles[i].x + state.obstacles[i].width < -50) {
        state.obstacles.splice(i, 1);
      }
    }

    // --- Move Coins ---
    for (let i = state.coins.length - 1; i >= 0; i--) {
      state.coins[i].x -= state.scrollSpeed;
      if (state.coins[i].x < -50) {
        state.coins.splice(i, 1);
      }
    }

    // --- Move Shrinkers ---
    for (let i = state.shrinkers.length - 1; i >= 0; i--) {
      state.shrinkers[i].x -= state.scrollSpeed;
      if (state.shrinkers[i].x < -50) {
        state.shrinkers.splice(i, 1);
      }
    }

    // --- Update Floating Texts ---
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const ft = state.floatingTexts[i];
      ft.y += ft.velocityY;
      ft.alpha -= 0.02;
      if (ft.alpha <= 0) {
        state.floatingTexts.splice(i, 1);
      }
    }

    // --- Update Particles ---
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // Particle gravity
      p.life--;
      p.alpha = p.life / 40;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
      }
    }

    // --- Visual Effect Timers ---
    if (state.flashTimer > 0) state.flashTimer--;
    if (state.squishTimer > 0) {
      state.squishTimer--;
      // Squish animation: wider and shorter when hitting, returns to normal
      const progress = state.squishTimer / 12;
      state.squishScaleX = 1 + progress * 0.3;
      state.squishScaleY = 1 - progress * 0.2;
    } else {
      state.squishScaleX = 1;
      state.squishScaleY = 1;
    }

    // --- Spawn Timers ---
    state.obstacleTimer++;
    if (state.obstacleTimer >= state.obstacleInterval) {
      state.obstacleTimer = 0;
      spawnObstacle(state);
      // Interval decreases slightly over time (min 60 frames = 1s)
      state.obstacleInterval = Math.max(60, randomRange(90, 180) - state.frameCount * 0.01);
    }

    state.coinTimer++;
    if (state.coinTimer >= state.coinInterval) {
      state.coinTimer = 0;
      spawnCoin(state);
      state.coinInterval = randomRange(60, 120);
    }

    state.shrinkerTimer++;
    if (state.shrinkerTimer >= state.shrinkerInterval) {
      state.shrinkerTimer = 0;
      spawnShrinker(state);
      state.shrinkerInterval = randomRange(480, 720);
    }

    // --- Difficulty Scaling (every 10 seconds = 600 frames) ---
    state.difficultyTimer++;
    if (state.difficultyTimer >= 600) {
      state.difficultyTimer = 0;
      state.scrollSpeed += 0.3; // Increase speed
    }

    // --- Check Collisions ---
    checkCollisions(state);

  }, []);

  // ==================== DRAW FUNCTION ====================
  const draw = useCallback((ctx: CanvasRenderingContext2D, state: GameState) => {
    // --- Clear & Background ---
    ctx.fillStyle = '#d1d5db'; // Light gray
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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

    // --- Draw Obstacles (Red squares/spikes) ---
    for (const obs of state.obstacles) {
      // Main body
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

      // Spike top (triangle)
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y);
      ctx.lineTo(obs.x + obs.width / 2, obs.y - 10);
      ctx.lineTo(obs.x + obs.width, obs.y);
      ctx.closePath();
      ctx.fill();

      // Border
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 2;
      ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    }

    // --- Draw Coins (Yellow circles) ---
    for (const coin of state.coins) {
      // Outer glow
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.fill();

      // Main coin
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dollar sign
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', coin.x, coin.y + 1);
    }

    // --- Draw Shrinkers (Green circles) ---
    for (const shrinker of state.shrinkers) {
      // Pulsing glow effect
      const pulse = Math.sin(state.frameCount * 0.1) * 3 + 3;
      ctx.beginPath();
      ctx.arc(shrinker.x, shrinker.y, shrinker.radius + pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(52, 211, 153, 0.2)';
      ctx.fill();

      // Main body
      ctx.beginPath();
      ctx.arc(shrinker.x, shrinker.y, shrinker.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Minus sign
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('−', shrinker.x, shrinker.y);
    }

    // --- Draw Particles ---
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- Draw Hero ---
    ctx.save();
    ctx.translate(HERO_X, state.heroY);
    ctx.scale(state.squishScaleX, state.squishScaleY);

    // Red flash effect
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

    ctx.restore();

    // --- Draw Floating Texts ---
    for (const ft of state.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    // --- UI: Score (top-left) ---
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${state.score}`, 15, 12);

    // --- UI: Size percentage (top-right) ---
    const sizePercent = Math.round((state.heroRadius / MAX_RADIUS) * 100);
    ctx.textAlign = 'right';
    ctx.fillText(`Size: ${sizePercent}%`, CANVAS_WIDTH - 15, 12);

    // --- UI: Danger Meter (size bar at top) ---
    const barX = 150;
    const barY = 12;
    const barWidth = CANVAS_WIDTH - 300;
    const barHeight = 18;
    const fillWidth = (state.heroRadius / MAX_RADIUS) * barWidth;

    // Bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Bar fill with color gradient based on danger level
    let barColor: string;
    if (sizePercent < 50) {
      barColor = '#22c55e'; // Green
    } else if (sizePercent < 80) {
      barColor = '#eab308'; // Yellow
    } else {
      barColor = '#ef4444'; // Red
    }
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, Math.min(fillWidth, barWidth), barHeight);

    // Bar border
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Bar label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DANGER', barX + barWidth / 2, barY + barHeight / 2);

    // --- Game Over Overlay ---
    if (state.isGameOver) {
      // Dark overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Game Over text
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

      // Stats
      ctx.fillStyle = '#fff';
      ctx.font = '24px Arial';
      ctx.fillText(`Final Score: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.fillText(`Max Size: ${Math.round(state.maxRadiusReached)}px`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35);

      // Restart instruction
      ctx.fillStyle = '#9ca3af';
      ctx.font = '18px Arial';
      ctx.fillText('Press R or Click to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 85);
    }

  }, []);

  // ==================== GAME LOOP ====================
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;

    // Update game state
    update(state);

    // Draw everything
    draw(ctx, state);

    // Continue loop
    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  // ==================== EFFECTS & EVENT LISTENERS ====================
  useEffect(() => {
    // Start game loop
    animFrameRef.current = requestAnimationFrame(gameLoop);

    // Keyboard handler
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (state.isGameOver) {
          handleRestart();
        } else {
          handleJump();
        }
      }
      if ((e.code === 'KeyR' || e.key === 'r' || e.key === 'R') && state.isGameOver) {
        handleRestart();
      }
    };

    // Mouse handler
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        const state = stateRef.current;
        if (state.isGameOver) {
          handleRestart();
        } else {
          handleJump();
        }
      }
    };

    // Touch handler
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const state = stateRef.current;
      if (state.isGameOver) {
        handleRestart();
      } else {
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
  }, [gameLoop, handleJump, handleRestart]);

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 select-none">
      <h1 className="text-3xl font-bold text-white mb-2">
        🏃 Hero Runner
      </h1>
      <p className="text-gray-400 mb-4 text-sm">
        Press <kbd className="px-2 py-1 bg-gray-700 rounded text-white text-xs font-mono">SPACE</kbd> or <span className="text-blue-400 font-semibold">Click</span> to Jump — Avoid growing too big!
      </p>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-600 rounded-lg shadow-2xl cursor-pointer max-w-full"
      />
      <div className="mt-4 flex gap-6 text-xs text-gray-500">
        <span>🟥 Obstacles = Grow</span>
        <span>🟢 Green = Shrink +5</span>
        <span>🟡 Coins = +10</span>
        <span>💀 Max size = Game Over</span>
      </div>
    </div>
  );
}

export default App;
