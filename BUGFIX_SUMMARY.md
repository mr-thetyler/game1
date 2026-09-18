# Hero Runner - Flying Obstacle Bug Fixes

## Summary
Fixed three critical bugs with flying obstacles (birds) and implemented additional improvements for better gameplay balance and visual feedback.

---

## Bug Fixes

### ✅ BUG 1: Birds Spawn Directly Above Ground Obstacles
**Problem:** Birds sometimes spawned at the same X position as ground obstacles, creating impossible situations.

**Solution:** Implemented "safe spawning" logic:
- Before spawning a bird, check if there's a ground obstacle within 200px of the intended spawn position
- If a nearby obstacle exists, the bird spawn is skipped for that cycle
- Birds now only appear in "safe windows" between ground obstacles

**Code Changes:**
```typescript
// Check if there's a ground obstacle within safe distance
const hasNearbyObstacle = state.obstacles.some(obs => {
  const obsCenterX = obs.x + obs.width / 2;
  return Math.abs(obsCenterX - spawnX) < FLYING_OBSTACLE_SAFE_DISTANCE;
});

// If there's a nearby obstacle, don't spawn the bird
if (hasNearbyObstacle) return;
```

---

### ✅ BUG 2: Birds Don't Scale with Speed Multiplier
**Problem:** Birds flew at constant speed, making them too slow at high game speeds (x3.0+).

**Solution:** Bird speed now scales with the global speed multiplier:
- Base horizontal speed: 3 pixels per frame
- Actual speed: `3 * speedMultiplier`
- At x1.0: 3px/frame, at x3.0: 9px/frame

**Code Changes:**
```typescript
const speedMultiplier = state.scrollSpeed / state.baseSpeed;
const velocityX = -(FLYING_OBSTACLE_BASE_SPEED * speedMultiplier);
```

---

### ✅ BUG 3: Birds Fly Too Slowly Downward
**Problem:** Birds descended too slowly, making them easy to avoid.

**Solution:** Increased downward velocity and scaled it with speed multiplier:
- Base downward speed: 2 pixels per frame
- Actual speed: `2 * speedMultiplier * tier_multiplier`
- Different tiers have different descent rates (see variety section below)

**Code Changes:**
```typescript
// Medium flyer (60%)
velocityY = FLYING_OBSTACLE_BASE_DOWN_SPEED * speedMultiplier * 1.2;

// High flyer (30%)
velocityY = FLYING_OBSTACLE_BASE_DOWN_SPEED * speedMultiplier * 1.8;

// Low flyer (10%)
velocityY = FLYING_OBSTACLE_BASE_DOWN_SPEED * speedMultiplier * 0.6;
```

---

## Additional Improvements

### 1. Bird Spawn Timing
- **Initial delay:** Increased from 2 seconds to 10 seconds (600 frames)
- **Spawn interval:** Now scales with speed multiplier
- **Formula:** `baseInterval / (1 + speedMultiplier * 0.1)`
- **Minimum interval:** 2 seconds (120 frames) between spawns

**Example:**
- At x1.0 speed: 4-8 seconds between spawns
- At x2.0 speed: ~3.6-7.3 seconds between spawns
- At x3.0 speed: ~3.1-6.5 seconds between spawns

---

### 2. Bird Visual Feedback (Shadow Indicator)
Added a shadow/warning indicator on the ground showing where the bird will land:
- Red elliptical shadow appears on the ground
- Pulsing effect for better visibility
- Helps players anticipate bird landing positions
- Only shows when bird is above ground level

**Implementation:**
```typescript
// Calculate where bird will land (project forward)
const framesToGround = (GROUND_Y - bird.y) / bird.velocityY;
const landingX = bird.x + bird.velocityX * framesToGround;

// Draw shadow with pulsing effect
ctx.globalAlpha = 0.3;
ctx.ellipse(landingX, GROUND_Y - 5, bird.size * 0.8, bird.size * 0.3, ...);
```

---

### 3. Bird Variety (New Distribution)
Changed from equal distribution to weighted variety:

| Type | Percentage | Start Y | Descent Speed | Characteristics |
|------|-----------|---------|---------------|-----------------|
| **Medium** | 60% | -150px | 1.2x base | Moderate angle, balanced difficulty |
| **High** | 30% | -250px | 1.8x base | Steep descent, fast arrival |
| **Low** | 10% | -80px | 0.6x base | Almost horizontal, hard to spot |

**Benefits:**
- More predictable gameplay with majority medium birds
- Occasional high birds add challenge
- Rare low birds create surprise moments

---

### 4. Collision Fairness
- **Hitbox reduction:** Bird collision radius reduced to 80% of visual size (was 90%)
- **Reasoning:** Birds come from above and are harder to see, so more forgiving collision
- **Still triggers:** Same "Ouch!" animation, growth, and invincibility frames as ground obstacles
- **Ice shield:** Birds can still be blocked by ice shield power-up

**Code Changes:**
```typescript
// Use smaller hitbox (0.8) for fairness
if (circleCircleCollision(HERO_X, state.heroY, heroR, bird.x, bird.y, bird.size * 0.8)) {
  handleObstacleHit(state, bird.x, bird.y);
}
```

---

## Constants Updated

```typescript
// Old constants
const FLYING_OBSTACLE_FIRST_DELAY = 120; // 2 seconds
const FLYING_OBSTACLE_SPEED_MULTIPLIER = 1.3;

// New constants
const FLYING_OBSTACLE_FIRST_DELAY = 600; // 10 seconds
const FLYING_OBSTACLE_BASE_SPEED = 3; // Base horizontal speed
const FLYING_OBSTACLE_BASE_DOWN_SPEED = 2; // Base downward speed
const FLYING_OBSTACLE_SAFE_DISTANCE = 200; // Safe spawn distance
```

---

## Testing Checklist

- [x] Birds no longer spawn directly above ground obstacles
- [x] Bird speed scales with game speed multiplier
- [x] Birds descend faster and reach ground in 2-3 seconds
- [x] Shadow indicator shows landing position
- [x] Bird variety follows 60/30/10 distribution
- [x] Collision hitbox is smaller (more forgiving)
- [x] Initial spawn delay is 10 seconds
- [x] Spawn interval decreases as speed increases
- [x] All existing mechanics still work (platforms, double jump, ice shield, etc.)

---

## Gameplay Impact

**Before:**
- Birds were too slow at high speeds
- Impossible situations with birds + ground obstacles
- No visual warning for incoming birds
- Equal distribution made gameplay monotonous

**After:**
- Birds remain threatening at all speeds
- Safe spawning prevents impossible situations
- Shadow indicators help players anticipate
- Varied bird types create dynamic gameplay
- More forgiving collisions reduce frustration

---

## Files Modified

- `src/App.tsx` - Main game logic
  - Updated flying obstacle constants (lines 57-62)
  - Rewrote `spawnFlyingObstacle()` function (lines 337-393)
  - Updated spawn timer logic (lines 887-895)
  - Added shadow indicator drawing (lines 1068-1090)
  - Adjusted collision hitbox (line 573)

---

**Build Status:** ✅ Successful
**No TypeScript errors**
**All features preserved**
