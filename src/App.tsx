import { useEffect, useRef, useCallback } from 'react';

/**
 * Hero Runner - HTML5 Canvas Game Prototype
 * 
 * A simple side-scrolling runner game featuring:
 * - A blue circle hero affected by gravity
 * - Jump mechanics (Spacebar or Left Click)
 * - No double-jump (only jump when grounded)
 * - Scrolling background lines for movement illusion
 */

// ==================== GAME CONSTANTS ====================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_Y = CANVAS_HEIGHT - 50; // Ground line position
const HERO_RADIUS = 30;
const HERO_X = 100; // Fixed horizontal position
const GRAVITY = 0.6; // Gravity acceleration per frame
const JUMP_FORCE = -12; // Upward velocity when jumping
const SCROLL_SPEED = 3; // Speed of background lines moving left
const LINE_SPACING = 80; // Distance between background lines

// ==================== GAME STATE ====================
interface GameState {
  heroY: number;        // Hero's vertical position
  velocityY: number;    // Hero's vertical velocity
  isGrounded: boolean;  // Whether hero is touching the ground
  scrollOffset: number; // Background scroll offset
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>({
    heroY: GROUND_Y - HERO_RADIUS,
    velocityY: 0,
    isGrounded: true,
    scrollOffset: 0,
  });
  const animationFrameRef = useRef<number>(0);

  // ==================== JUMP HANDLER ====================
  /**
   * Handles jump input - only allows jumping when hero is on the ground.
   * Prevents double-jump by checking isGrounded state.
   */
  const handleJump = useCallback(() => {
    const state = gameStateRef.current;
    if (state.isGrounded) {
      state.velocityY = JUMP_FORCE;
      state.isGrounded = false;
    }
  }, []);

  // ==================== GAME LOOP ====================
  /**
   * Main game loop using requestAnimationFrame.
   * Updates physics and renders each frame.
   */
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = gameStateRef.current;

    // --- UPDATE PHYSICS ---
    // Apply gravity to vertical velocity
    state.velocityY += GRAVITY;

    // Update hero position
    state.heroY += state.velocityY;

    // Ground collision detection
    if (state.heroY >= GROUND_Y - HERO_RADIUS) {
      state.heroY = GROUND_Y - HERO_RADIUS;
      state.velocityY = 0;
      state.isGrounded = true;
    }

    // Update background scroll offset (creates movement illusion)
    state.scrollOffset += SCROLL_SPEED;
    if (state.scrollOffset >= LINE_SPACING) {
      state.scrollOffset -= LINE_SPACING; // Loop infinitely
    }

    // --- RENDER ---
    // Clear canvas with light gray background
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw scrolling background lines (vertical white lines moving right to left)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;

    // Calculate how many lines we need to cover the canvas plus extra for seamless looping
    const numLines = Math.ceil(CANVAS_WIDTH / LINE_SPACING) + 2;

    for (let i = 0; i < numLines; i++) {
      const lineX = i * LINE_SPACING - state.scrollOffset;
      ctx.beginPath();
      ctx.moveTo(lineX, 0);
      ctx.lineTo(lineX, GROUND_Y);
      ctx.stroke();
    }

    // Draw ground (solid black line at the bottom)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    // Draw ground fill below the line
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    // Draw hero (blue circle)
    ctx.fillStyle = '#2563eb'; // Blue color
    ctx.beginPath();
    ctx.arc(HERO_X, state.heroY, HERO_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Add a subtle highlight to the hero for depth
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(HERO_X - 8, state.heroY - 8, HERO_RADIUS * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Draw hero eyes (simple face)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(HERO_X + 8, state.heroY - 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(HERO_X + 10, state.heroY - 5, 3, 0, Math.PI * 2);
    ctx.fill();

    // --- REQUEST NEXT FRAME ---
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, []);

  // ==================== INITIALIZATION & EVENT LISTENERS ====================
  useEffect(() => {
    // Start the game loop
    animationFrameRef.current = requestAnimationFrame(gameLoop);

    // Keyboard event listener for Spacebar jump
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // Prevent page scroll
        handleJump();
      }
    };

    // Mouse click event listener for jump
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { // Left mouse button only
        handleJump();
      }
    };

    // Touch event for mobile support
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      handleJump();
    };

    // Attach event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [gameLoop, handleJump]);

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      {/* Game Title */}
      <h1 className="text-3xl font-bold text-white mb-2 tracking-wide">
        🏃 Hero Runner
      </h1>

      {/* Instructions */}
      <p className="text-gray-400 mb-4 text-sm">
        Press <kbd className="px-2 py-1 bg-gray-700 rounded text-white text-xs font-mono">SPACE</kbd> or <span className="text-blue-400 font-semibold">Click</span> to Jump
      </p>

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-600 rounded-lg shadow-2xl cursor-pointer max-w-full"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Footer info */}
      <p className="text-gray-500 mt-4 text-xs">
        HTML5 Canvas Game • No double-jump • Gravity physics • Infinite scrolling
      </p>
    </div>
  );
}

export default App;
