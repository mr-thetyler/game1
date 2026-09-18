import { useEffect, useRef, useCallback } from 'react';

/**
 * Hero Runner - HTML5 Canvas Game
 * 
 * Features:
 * - Player character with jump and slide mechanics
 * - Ground obstacles with spikes
 * - Flying birds with horizontal movement and vertical drift
 * - Platforms to jump on
 * - Coins for points
 * - Ice shields for temporary invincibility
 * - Shrinkers to reduce player size
 * - Score tracking with localStorage high score
 * - Start screen and game over screen
 */

// ==================== TYPES ====================
interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  isJumping: boolean;
  isSliding: boolean;
  isInvincible: boolean;
  invincibilityTime: number;
  faceDirection: number;
  shrinkFactor: number;
  blinkTimer: number;
}

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GroundObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FlyingObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  verticalDrift: number;
  rotation: number;
}

interface Coin {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface IceShield {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Shrinker {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GameState {
  score: number;
  highScore: number;
  gameRunning: boolean;
  gameStarted: boolean;
}

// ==================== CONSTANTS ====================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GRAVITY = 0.8;
const JUMP_FORCE = -15;
const GROUND_Y = 350;
const PLAYER_RUN_SPEED = 5;

const OBSTACLE_SPAWN_INTERVAL = 100;
const COIN_SPAWN_INTERVAL = 200;
const PLATFORM_SPAWN_INTERVAL = 300;
const FLYING_OBSTACLE_BASE_SPEED = 4;
const FLYING_OBSTACLE_VERTICAL_DRIFT = [-1, -0.5, 0, 0.5, 1];
const FLYING_OBSTACLE_HITBOX = 20;
const FLYING_OBSTACLE_SPAWN_MIN = 300;
const FLYING_OBSTACLE_SPAWN_MAX = 600;
const FLYING_OBSTACLE_SAFE_DISTANCE = 150;

const HIGH_SCORE_KEY = 'heroRunnerHighScore';

// ==================== MAIN COMPONENT ====================
function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>({
    score: 0,
    highScore: parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0'),
    gameRunning: false,
    gameStarted: false,
  });

  const playerRef = useRef<Player>({
    x: 100,
    y: GROUND_Y - 50,
    width: 40,
    height: 50,
    velocityY: 0,
    isJumping: false,
    isSliding: false,
    isInvincible: false,
    invincibilityTime: 0,
    faceDirection: 1,
    shrinkFactor: 1,
    blinkTimer: 0,
  });

  const platformsRef = useRef<Platform[]>([]);
  const groundObstaclesRef = useRef<GroundObstacle[]>([]);
  const flyingObstaclesRef = useRef<FlyingObstacle[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const iceShieldsRef = useRef<IceShield[]>([]);
  const shrinkersRef = useRef<Shrinker[]>([]);

  const timersRef = useRef({
    obstacleSpawnTimer: 0,
    coinSpawnTimer: 0,
    platformSpawnTimer: 0,
    birdSpawnTimer: 0,
    shrinkTimer: 0,
    speedMultiplier: 1,
    gameStartTime: 0,
    lastTime: 0,
  });

  const keysRef = useRef<Record<string, boolean>>({});
  const animFrameRef = useRef<number>(0);

  // ==================== INITIALIZATION ====================
  const initGame = useCallback(() => {
    const player = playerRef.current;
    player.x = 100;
    player.y = GROUND_Y - player.height;
    player.velocityY = 0;
    player.isJumping = false;
    player.isSliding = false;
    player.isInvincible = false;
    player.invincibilityTime = 0;
    player.shrinkFactor = 1;
    player.blinkTimer = 0;

    platformsRef.current = [];
    groundObstaclesRef.current = [];
    flyingObstaclesRef.current = [];
    coinsRef.current = [];
    iceShieldsRef.current = [];
    shrinkersRef.current = [];

    const state = gameStateRef.current;
    state.score = 0;
    state.gameRunning = true;
    state.gameStarted = true;

    const timers = timersRef.current;
    timers.obstacleSpawnTimer = 0;
    timers.coinSpawnTimer = 0;
    timers.platformSpawnTimer = 0;
    timers.birdSpawnTimer = 0;
    timers.shrinkTimer = 0;
    timers.speedMultiplier = 1;
    timers.gameStartTime = Date.now();
  }, []);

  // ==================== DRAW FUNCTIONS ====================
  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D) => {
    const player = playerRef.current;
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    ctx.scale(player.faceDirection, 1);
    ctx.scale(player.shrinkFactor, player.shrinkFactor);

    // Body
    ctx.fillStyle = '#3498db';
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);

    // Head
    ctx.beginPath();
    ctx.arc(0, -player.height / 3, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#f1c40f';
    ctx.fill();

    // Eyes
    ctx.beginPath();
    ctx.arc(-5, -player.height / 3 - 3, 3, 0, Math.PI * 2);
    ctx.arc(5, -player.height / 3 - 3, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();

    // Pupils
    ctx.beginPath();
    ctx.arc(-5, -player.height / 3 - 3, 1.5, 0, Math.PI * 2);
    ctx.arc(5, -player.height / 3 - 3, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'black';
    ctx.fill();

    // Mouth
    ctx.beginPath();
    ctx.arc(0, -player.height / 3 + 2, 5, 0, Math.PI);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Legs
    ctx.fillStyle = '#2980b9';
    ctx.fillRect(-10, player.height / 2 - 15, 8, 15);
    ctx.fillRect(2, player.height / 2 - 15, 8, 15);

    ctx.restore();
  }, []);

  const drawPlatforms = useCallback((ctx: CanvasRenderingContext2D) => {
    platformsRef.current.forEach(platform => {
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(platform.x, platform.y, platform.width, 5);
    });
  }, []);

  const drawGroundObstacles = useCallback((ctx: CanvasRenderingContext2D) => {
    groundObstaclesRef.current.forEach(obstacle => {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

      for (let i = 0; i < obstacle.width; i += 10) {
        ctx.beginPath();
        ctx.moveTo(obstacle.x + i, obstacle.y);
        ctx.lineTo(obstacle.x + i + 5, obstacle.y - 10);
        ctx.lineTo(obstacle.x + i + 10, obstacle.y);
        ctx.closePath();
        ctx.fillStyle = '#c0392b';
        ctx.fill();
      }
    });
  }, []);

  const drawFlyingObstacles = useCallback((ctx: CanvasRenderingContext2D) => {
    flyingObstaclesRef.current.forEach(bird => {
      ctx.save();
      ctx.translate(bird.x + 15, bird.y + 15);
      ctx.rotate(bird.rotation);

      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(15, 0);
      ctx.lineTo(0, 15);
      ctx.lineTo(-15, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.lineTo(-20, -10);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(10, -5);
      ctx.lineTo(20, -10);
      ctx.lineTo(10, 0);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    });
  }, []);

  const drawCoins = useCallback((ctx: CanvasRenderingContext2D) => {
    coinsRef.current.forEach(coin => {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(coin.x + coin.width / 2, coin.y + coin.height / 2, coin.width / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(coin.x + coin.width / 2 - 3, coin.y + coin.height / 2 - 3, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }, []);

  const drawIceShields = useCallback((ctx: CanvasRenderingContext2D) => {
    iceShieldsRef.current.forEach(shield => {
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.arc(shield.x + shield.width / 2, shield.y + shield.height / 2, shield.width / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#aed6f1';
      ctx.beginPath();
      ctx.arc(shield.x + shield.width / 2, shield.y + shield.height / 2, shield.width / 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#d6eaf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(shield.x + shield.width / 2, shield.y + 5);
      ctx.lineTo(shield.x + shield.width / 2, shield.y + shield.height - 5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(shield.x + 5, shield.y + shield.height / 2);
      ctx.lineTo(shield.x + shield.width - 5, shield.y + shield.height / 2);
      ctx.stroke();
    });
  }, []);

  const drawShrinkers = useCallback((ctx: CanvasRenderingContext2D) => {
    shrinkersRef.current.forEach(shrinker => {
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath();
      ctx.arc(shrinker.x + shrinker.width / 2, shrinker.y + shrinker.height / 2, shrinker.width / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#d2b4de';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(shrinker.x + shrinker.width / 2, shrinker.y + 5);
      ctx.lineTo(shrinker.x + shrinker.width / 2, shrinker.y + shrinker.height - 5);
      ctx.stroke();

      ctx.font = '20px Arial';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', shrinker.x + shrinker.width / 2, shrinker.y + shrinker.height / 2);
    });
  }, []);

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    const skyGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#E0F7FA');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH - 50, 50, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const drawCloud = (x: number, y: number, radius: number) => {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.arc(x + radius * 0.8, y - radius * 0.5, radius * 0.8, 0, Math.PI * 2);
      ctx.arc(x + radius * 1.5, y, radius * 0.9, 0, Math.PI * 2);
      ctx.arc(x + radius * 0.8, y + radius * 0.5, radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCloud(100, 80, 30);
    drawCloud(300, 60, 40);
    drawCloud(500, 100, 35);
    drawCloud(700, 70, 25);

    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    ctx.fillStyle = '#2E8B57';
    ctx.fillRect(0, GROUND_Y - 10, CANVAS_WIDTH, 10);
  }, []);

  // ==================== SPAWN FUNCTIONS ====================
  const spawnPlatform = useCallback(() => {
    const timers = timersRef.current;
    if (timers.platformSpawnTimer <= 0) {
      const platformWidth = 100 + Math.random() * 100;
      const platformHeight = 20;
      const platformX = CANVAS_WIDTH;
      const platformY = GROUND_Y - 100 - Math.random() * 150;

      platformsRef.current.push({
        x: platformX,
        y: platformY,
        width: platformWidth,
        height: platformHeight,
      });

      timers.platformSpawnTimer = PLATFORM_SPAWN_INTERVAL;
    } else {
      timers.platformSpawnTimer--;
    }
  }, []);

  const spawnGroundObstacle = useCallback(() => {
    const timers = timersRef.current;
    if (timers.obstacleSpawnTimer <= 0) {
      const obstacleWidth = 30 + Math.random() * 40;
      const obstacleHeight = 30 + Math.random() * 40;
      const obstacleX = CANVAS_WIDTH;
      const obstacleY = GROUND_Y - obstacleHeight;

      groundObstaclesRef.current.push({
        x: obstacleX,
        y: obstacleY,
        width: obstacleWidth,
        height: obstacleHeight,
      });

      timers.obstacleSpawnTimer = OBSTACLE_SPAWN_INTERVAL;
    } else {
      timers.obstacleSpawnTimer--;
    }
  }, []);

  const spawnFlyingObstacle = useCallback(() => {
    const timers = timersRef.current;
    const elapsedSeconds = (Date.now() - timers.gameStartTime) / 1000;
    if (elapsedSeconds < 10) return;

    if (timers.birdSpawnTimer <= 0) {
      const baseInterval = Math.random() * (FLYING_OBSTACLE_SPAWN_MAX - FLYING_OBSTACLE_SPAWN_MIN) + FLYING_OBSTACLE_SPAWN_MIN;
      const adjustedInterval = baseInterval / (1 + timers.speedMultiplier * 0.15);

      const rand = Math.random();
      let spawnY: number;

      if (rand < 0.6) {
        spawnY = 100 + Math.random() * 100;
      } else if (rand < 0.85) {
        spawnY = 50 + Math.random() * 50;
      } else {
        spawnY = 200 + Math.random() * 50;
      }

      const isSafeToSpawn = !groundObstaclesRef.current.some(obstacle => {
        return (
          obstacle.x < CANVAS_WIDTH + 50 &&
          obstacle.x + obstacle.width > CANVAS_WIDTH - 50 &&
          Math.abs(obstacle.y - spawnY) < FLYING_OBSTACLE_SAFE_DISTANCE
        );
      });

      if (isSafeToSpawn) {
        const verticalDrift = FLYING_OBSTACLE_VERTICAL_DRIFT[Math.floor(Math.random() * FLYING_OBSTACLE_VERTICAL_DRIFT.length)];

        flyingObstaclesRef.current.push({
          x: CANVAS_WIDTH + 50,
          y: spawnY,
          width: 30,
          height: 30,
          verticalDrift: verticalDrift,
          rotation: 0,
        });
      }

      timers.birdSpawnTimer = adjustedInterval;
    } else {
      timers.birdSpawnTimer--;
    }
  }, []);

  const spawnCoin = useCallback(() => {
    const timers = timersRef.current;
    if (timers.coinSpawnTimer <= 0) {
      const coinX = CANVAS_WIDTH;
      const coinY = GROUND_Y - 100 - Math.random() * 150;

      coinsRef.current.push({
        x: coinX,
        y: coinY,
        width: 20,
        height: 20,
      });

      timers.coinSpawnTimer = COIN_SPAWN_INTERVAL;
    } else {
      timers.coinSpawnTimer--;
    }
  }, []);

  const spawnIceShield = useCallback(() => {
    if (Math.random() < 0.002) {
      const shieldX = CANVAS_WIDTH;
      const shieldY = GROUND_Y - 100 - Math.random() * 150;

      iceShieldsRef.current.push({
        x: shieldX,
        y: shieldY,
        width: 25,
        height: 25,
      });
    }
  }, []);

  const spawnShrinker = useCallback(() => {
    if (Math.random() < 0.0015) {
      const shrinkerX = CANVAS_WIDTH;
      const shrinkerY = GROUND_Y - 100 - Math.random() * 150;

      shrinkersRef.current.push({
        x: shrinkerX,
        y: shrinkerY,
        width: 25,
        height: 25,
      });
    }
  }, []);

  // ==================== UPDATE FUNCTIONS ====================
  const updateGameObjects = useCallback((deltaTime: number) => {
    const player = playerRef.current;
    const state = gameStateRef.current;
    const timers = timersRef.current;
    const keys = keysRef.current;

    if (!state.gameRunning) return;

    // Player movement
    if (keys['Space'] || keys['ArrowUp']) {
      if (!player.isJumping && player.y >= GROUND_Y - player.height) {
        player.velocityY = JUMP_FORCE;
        player.isJumping = true;
      }
    }

    if (keys['ArrowDown']) {
      if (!player.isJumping && !player.isSliding && player.y >= GROUND_Y - player.height) {
        player.isSliding = true;
        player.height = 30;
        player.y = GROUND_Y - player.height;
      }
    } else {
      if (player.isSliding) {
        player.isSliding = false;
        player.height = 50;
        player.y = GROUND_Y - player.height;
      }
    }

    // Gravity
    if (player.isJumping || player.y < GROUND_Y - player.height) {
      player.velocityY += GRAVITY;
      player.y += player.velocityY;

      if (player.y >= GROUND_Y - player.height) {
        player.y = GROUND_Y - player.height;
        player.velocityY = 0;
        player.isJumping = false;
      }
    }

    // Invincibility
    if (player.isInvincible) {
      player.invincibilityTime -= deltaTime;
      if (player.invincibilityTime <= 0) {
        player.isInvincible = false;
        player.invincibilityTime = 0;
      }
    }

    // Shrink timer
    if (timers.shrinkTimer > 0) {
      timers.shrinkTimer -= deltaTime;
      if (timers.shrinkTimer <= 0) {
        player.shrinkFactor = 1;
      }
    }

    // Blink timer
    if (player.isInvincible) {
      player.blinkTimer += deltaTime;
    } else {
      player.blinkTimer = 0;
    }

    // Update platforms
    platformsRef.current.forEach(platform => {
      platform.x -= 5 * timers.speedMultiplier;
    });
    platformsRef.current = platformsRef.current.filter(platform => platform.x + platform.width > 0);

    // Update ground obstacles
    groundObstaclesRef.current.forEach(obstacle => {
      obstacle.x -= 5 * timers.speedMultiplier;
    });
    groundObstaclesRef.current = groundObstaclesRef.current.filter(obstacle => obstacle.x + obstacle.width > 0);

    // Update flying obstacles
    flyingObstaclesRef.current.forEach(bird => {
      bird.x -= FLYING_OBSTACLE_BASE_SPEED * timers.speedMultiplier;
      bird.y += bird.verticalDrift * timers.speedMultiplier;
      bird.rotation = bird.verticalDrift * 0.05;
    });
    flyingObstaclesRef.current = flyingObstaclesRef.current.filter(bird =>
      bird.x > -50 && bird.y < CANVAS_HEIGHT && bird.y > -100
    );

    // Update coins
    coinsRef.current.forEach(coin => {
      coin.x -= 5 * timers.speedMultiplier;
    });
    coinsRef.current = coinsRef.current.filter(coin => coin.x + coin.width > 0);

    // Update ice shields
    iceShieldsRef.current.forEach(shield => {
      shield.x -= 5 * timers.speedMultiplier;
    });
    iceShieldsRef.current = iceShieldsRef.current.filter(shield => shield.x + shield.width > 0);

    // Update shrinkers
    shrinkersRef.current.forEach(shrinker => {
      shrinker.x -= 5 * timers.speedMultiplier;
    });
    shrinkersRef.current = shrinkersRef.current.filter(shrinker => shrinker.x + shrinker.width > 0);

    // Increase speed
    timers.speedMultiplier = 1 + (Date.now() - timers.gameStartTime) / 10000;
  }, []);

  const checkCollisions = useCallback(() => {
    const player = playerRef.current;
    const state = gameStateRef.current;

    // Ground obstacles
    for (const obstacle of groundObstaclesRef.current) {
      if (
        player.x < obstacle.x + obstacle.width &&
        player.x + player.width > obstacle.x &&
        player.y < obstacle.y + obstacle.height &&
        player.y + player.height > obstacle.y
      ) {
        if (!player.isInvincible) {
          state.gameRunning = false;
          if (state.score > state.highScore) {
            state.highScore = state.score;
            localStorage.setItem(HIGH_SCORE_KEY, state.highScore.toString());
          }
          return;
        }
      }
    }

    // Flying obstacles
    for (const bird of flyingObstaclesRef.current) {
      const playerHitBox = {
        x: player.x + 5,
        y: player.y + 5,
        width: player.width - 10,
        height: player.height - 10,
      };

      const birdHitBox = {
        x: bird.x + (bird.width - FLYING_OBSTACLE_HITBOX) / 2,
        y: bird.y + (bird.height - FLYING_OBSTACLE_HITBOX) / 2,
        width: FLYING_OBSTACLE_HITBOX,
        height: FLYING_OBSTACLE_HITBOX,
      };

      if (
        playerHitBox.x < birdHitBox.x + birdHitBox.width &&
        playerHitBox.x + playerHitBox.width > birdHitBox.x &&
        playerHitBox.y < birdHitBox.y + birdHitBox.height &&
        playerHitBox.y + playerHitBox.height > birdHitBox.y
      ) {
        if (!player.isInvincible) {
          state.gameRunning = false;
          if (state.score > state.highScore) {
            state.highScore = state.score;
            localStorage.setItem(HIGH_SCORE_KEY, state.highScore.toString());
          }
          return;
        }
      }
    }

    // Coins
    for (let i = coinsRef.current.length - 1; i >= 0; i--) {
      const coin = coinsRef.current[i];
      if (
        player.x < coin.x + coin.width &&
        player.x + player.width > coin.x &&
        player.y < coin.y + coin.height &&
        player.y + player.height > coin.y
      ) {
        coinsRef.current.splice(i, 1);
        state.score += 10;
      }
    }

    // Ice shields
    for (let i = iceShieldsRef.current.length - 1; i >= 0; i--) {
      const shield = iceShieldsRef.current[i];
      if (
        player.x < shield.x + shield.width &&
        player.x + player.width > shield.x &&
        player.y < shield.y + shield.height &&
        player.y + player.height > shield.y
      ) {
        iceShieldsRef.current.splice(i, 1);
        player.isInvincible = true;
        player.invincibilityTime = 3000;
      }
    }

    // Shrinkers
    for (let i = shrinkersRef.current.length - 1; i >= 0; i--) {
      const shrinker = shrinkersRef.current[i];
      if (
        player.x < shrinker.x + shrinker.width &&
        player.x + player.width > shrinker.x &&
        player.y < shrinker.y + shrinker.height &&
        player.y + player.height > shrinker.y
      ) {
        shrinkersRef.current.splice(i, 1);
        player.shrinkFactor = 0.7;
        timersRef.current.shrinkTimer = 5000;
      }
    }

    // Platform collision
    let onPlatform = false;
    for (const platform of platformsRef.current) {
      if (
        player.x + player.width > platform.x &&
        player.x < platform.x + platform.width &&
        player.y + player.height <= platform.y + 5 &&
        player.y + player.height + player.velocityY > platform.y
      ) {
        player.y = platform.y - player.height;
        player.velocityY = 0;
        player.isJumping = false;
        onPlatform = true;
        break;
      }
    }

    if (!onPlatform && player.y < GROUND_Y - player.height) {
      player.isJumping = true;
    }
  }, []);

  // ==================== GAME LOOP ====================
  const gameLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = gameStateRef.current;
    const timers = timersRef.current;

    const deltaTime = timestamp - timers.lastTime;
    timers.lastTime = timestamp;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawBackground(ctx);

    if (state.gameRunning) {
      updateGameObjects(deltaTime);
      spawnPlatform();
      spawnGroundObstacle();
      spawnFlyingObstacle();
      spawnCoin();
      spawnIceShield();
      spawnShrinker();
      checkCollisions();

      if (deltaTime > 0) {
        state.score += deltaTime / 100;
      }
    }

    drawPlatforms(ctx);
    drawGroundObstacles(ctx);
    drawFlyingObstacles(ctx);
    drawCoins(ctx);
    drawIceShields(ctx);
    drawShrinkers(ctx);

    const player = playerRef.current;
    if (!player.isInvincible || Math.floor(player.blinkTimer / 100) % 2 === 0) {
      drawPlayer(ctx);
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [
    drawBackground,
    drawPlatforms,
    drawGroundObstacles,
    drawFlyingObstacles,
    drawCoins,
    drawIceShields,
    drawShrinkers,
    drawPlayer,
    updateGameObjects,
    spawnPlatform,
    spawnGroundObstacle,
    spawnFlyingObstacle,
    spawnCoin,
    spawnIceShield,
    spawnShrinker,
    checkCollisions,
  ]);

  // ==================== EFFECTS & EVENT LISTENERS ====================
  useEffect(() => {
    timersRef.current.lastTime = performance.now();
    animFrameRef.current = requestAnimationFrame(gameLoop);

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameLoop]);

  // ==================== RENDER ====================
  const state = gameStateRef.current;
  const player = playerRef.current;

  return (
    <div className="min-h-screen bg-slate-800 flex flex-col items-center justify-center p-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-4 border-slate-600 rounded-lg shadow-2xl"
        />

        {/* Score Display */}
        <div className="absolute top-5 left-5 text-white text-2xl font-bold" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
          Score: {Math.floor(state.score)}
        </div>

        {/* High Score Display */}
        <div className="absolute top-5 right-5 text-yellow-400 text-xl font-bold" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
          High Score: {state.highScore}
        </div>

        {/* Game Over Screen */}
        {!state.gameRunning && state.gameStarted && (
          <div className="absolute inset-0 bg-black/80 flex flex-col justify-center items-center text-white text-5xl font-bold" style={{ textShadow: '0 0 10px #ff0000' }}>
            GAME OVER!
            <button
              onClick={initGame}
              className="mt-5 px-6 py-3 bg-red-600 text-white text-2xl font-bold rounded-full hover:bg-red-700 transition-all hover:scale-110"
            >
              PLAY AGAIN
            </button>
          </div>
        )}

        {/* Start Screen */}
        {!state.gameStarted && (
          <div className="absolute inset-0 bg-black/80 flex flex-col justify-center items-center text-white text-center">
            <h1 className="text-6xl font-bold mb-2 text-yellow-400" style={{ textShadow: '0 0 10px #f39c12, 0 0 20px #e67e22' }}>
              HERO RUNNER
            </h1>
            <div className="text-xl max-w-[80%] leading-relaxed my-5">
              <p>Dodge obstacles, collect coins, and avoid flying birds!</p>
              <p className="mt-2">
                Press <kbd className="px-2 py-1 bg-slate-700 rounded border border-slate-500 mx-1">SPACE</kbd> or <kbd className="px-2 py-1 bg-slate-700 rounded border border-slate-500 mx-1">↑</kbd> to jump
              </p>
              <p>
                Press <kbd className="px-2 py-1 bg-slate-700 rounded border border-slate-500 mx-1">↓</kbd> to slide under obstacles
              </p>
              <p>Collect ice shields to become invincible!</p>
            </div>
            <button
              onClick={initGame}
              className="mt-8 px-8 py-4 bg-green-500 text-white text-3xl font-bold rounded-full hover:bg-green-600 transition-all hover:scale-110"
            >
              START GAME
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-sm text-slate-400">
        <span>🟥 Obstacles = Game Over</span>
        <span>🔴 Birds = Game Over</span>
        <span>🟡 Coins = +10</span>
        <span>🔵 Ice Shield = Invincibility</span>
        <span>🟣 Shrinker = Smaller Size</span>
        <span>🟩 Platforms = Jump On</span>
      </div>
    </div>
  );
}

export default App;
