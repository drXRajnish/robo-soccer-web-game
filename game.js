// ==========================================
//  ROBO-SOCCER — Full Game Engine
// ==========================================

// ===== CONFIGURATION =====
const CONFIG = {
  fieldPadding: 40,
  hudHeight: 60,
  matchDuration: 180, // seconds
  goalPause: 2000,    // ms
  robotRadius: 18,
  ballRadius: 10,
  robotSpeed: 3.2,
  boostMultiplier: 2.2,
  ballFriction: 0.985,
  robotFriction: 0.9,
  kickForce: 8,
  boostKickForce: 14,
  goalWidth: 100,
  goalDepth: 24,
  maxBallSpeed: 15,
  teamSize: 4, // per team (incl. goalkeeper)
  difficulty: 'easy',
  aiSpeeds: { easy: 1.8, medium: 2.6, hard: 3.2 },
  aiReaction: { easy: 0.4, medium: 0.7, hard: 0.95 },
};

// ===== GAME STATE =====
let canvas, ctx;
let gameState = 'menu'; // menu, playing, paused, goal, gameover
let scoreBlue = 0, scoreRed = 0;
let timeRemaining = CONFIG.matchDuration;
let lastTimestamp = 0;
let deltaAccumulator = 0;
let selectedRobot = 0;
let particles = [];
let trailParticles = [];

// Input
const keys = {};
let boostActive = false;

// Entities
let ball = null;
let blueTeam = [];
let redTeam = [];

// Field dims (computed)
let field = { x: 0, y: 0, w: 0, h: 0 };
let goalLeft = {}, goalRight = {};

// ===== UTILITY =====
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function normalize(vx, vy) {
  const len = Math.hypot(vx, vy);
  return len > 0 ? { x: vx / len, y: vy / len } : { x: 0, y: 0 };
}
function rand(min, max) { return Math.random() * (max - min) + min; }

// ===== ENTITY FACTORIES =====
function createBall() {
  return {
    x: field.x + field.w / 2,
    y: field.y + field.h / 2,
    vx: 0, vy: 0,
    radius: CONFIG.ballRadius,
    trail: [],
  };
}

function createRobot(team, index, total) {
  const isGoalkeeper = index === 0;
  const r = CONFIG.robotRadius;
  let x, y;

  if (team === 'blue') {
    if (isGoalkeeper) {
      x = field.x + 40;
      y = field.y + field.h / 2;
    } else {
      const spacing = field.h / (total);
      x = field.x + field.w * 0.25 + (index % 2) * 60;
      y = field.y + spacing * index + spacing / 2;
    }
  } else {
    if (isGoalkeeper) {
      x = field.x + field.w - 40;
      y = field.y + field.h / 2;
    } else {
      const spacing = field.h / (total);
      x = field.x + field.w * 0.75 - (index % 2) * 60;
      y = field.y + spacing * index + spacing / 2;
    }
  }

  return {
    x, y, vx: 0, vy: 0,
    radius: r,
    team,
    index,
    isGoalkeeper,
    boostCooldown: 0,
    angle: team === 'blue' ? 0 : Math.PI,
    eyeBlink: 0,
    antennaPhase: Math.random() * Math.PI * 2,
    homeX: x,
    homeY: y,
  };
}

// ===== FIELD COMPUTATION =====
function computeField() {
  const padding = CONFIG.fieldPadding;
  const hud = CONFIG.hudHeight;
  field.x = padding;
  field.y = padding + hud;
  field.w = canvas.width - padding * 2;
  field.h = canvas.height - padding * 2 - hud;

  const gw = CONFIG.goalWidth;
  const gd = CONFIG.goalDepth;
  const centerY = field.y + field.h / 2;

  goalLeft = {
    x: field.x - gd, y: centerY - gw / 2,
    w: gd, h: gw,
  };
  goalRight = {
    x: field.x + field.w, y: centerY - gw / 2,
    w: gd, h: gw,
  };
}

// ===== INIT =====
function initGame() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  computeField();
}

function resetEntities() {
  computeField();
  ball = createBall();
  blueTeam = [];
  redTeam = [];
  for (let i = 0; i < CONFIG.teamSize; i++) {
    blueTeam.push(createRobot('blue', i, CONFIG.teamSize));
    redTeam.push(createRobot('red', i, CONFIG.teamSize));
  }
  selectedRobot = 1; // start with first field player
  particles = [];
  trailParticles = [];
}

// ===== INPUT =====
function onKeyDown(e) {
  keys[e.code] = true;
  if (e.code === 'Tab') {
    e.preventDefault();
    // Cycle through field players (skip goalkeeper index 0)
    selectedRobot = ((selectedRobot) % (CONFIG.teamSize - 1)) + 1;
  }
  if (e.code === 'KeyP' && gameState === 'playing') {
    togglePause();
  }
  if (e.code === 'Space') {
    e.preventDefault();
    boostActive = true;
  }
}
function onKeyUp(e) {
  keys[e.code] = false;
  if (e.code === 'Space') boostActive = false;
}

// ===== SCREEN MANAGEMENT =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function startGame() {
  scoreBlue = 0;
  scoreRed = 0;
  timeRemaining = CONFIG.matchDuration;
  resetEntities();
  updateHUD();
  showScreen('game-screen');
  gameState = 'playing';
  lastTimestamp = performance.now();
}

function restartGame() {
  startGame();
}

function goToMenu() {
  gameState = 'menu';
  showScreen('start-screen');
}

function toggleHowTo() {
  document.getElementById('how-to-play').classList.toggle('hidden');
}

function setDifficulty(diff, btn) {
  CONFIG.difficulty = diff;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    document.getElementById('pause-overlay').classList.remove('hidden');
  } else if (gameState === 'paused') {
    gameState = 'playing';
    document.getElementById('pause-overlay').classList.add('hidden');
    lastTimestamp = performance.now();
  }
}

// ===== HUD =====
function updateHUD() {
  document.getElementById('score-blue').textContent = scoreBlue;
  document.getElementById('score-red').textContent = scoreRed;
  const mins = Math.floor(timeRemaining / 60);
  const secs = Math.floor(timeRemaining % 60);
  document.getElementById('game-timer').textContent =
    `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ===== PARTICLES =====
function spawnGoalParticles(x, y, color) {
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(2, 10);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.5, 1.5),
      maxLife: rand(0.5, 1.5),
      radius: rand(2, 6),
      color,
    });
  }
}

function spawnKickParticles(x, y) {
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(1, 4);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.2, 0.5),
      maxLife: rand(0.2, 0.5),
      radius: rand(1, 3),
      color: '#ffffff',
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ===== BALL TRAIL =====
function updateBallTrail() {
  if (!ball) return;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > 2) {
    trailParticles.push({
      x: ball.x, y: ball.y,
      life: 0.3,
      maxLife: 0.3,
      radius: ball.radius * 0.6,
    });
  }
  for (let i = trailParticles.length - 1; i >= 0; i--) {
    trailParticles[i].life -= 0.016;
    if (trailParticles[i].life <= 0) trailParticles.splice(i, 1);
  }
}

// ===== PHYSICS =====
function updateBall() {
  ball.vx *= CONFIG.ballFriction;
  ball.vy *= CONFIG.ballFriction;

  // Clamp speed
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > CONFIG.maxBallSpeed) {
    ball.vx = (ball.vx / speed) * CONFIG.maxBallSpeed;
    ball.vy = (ball.vy / speed) * CONFIG.maxBallSpeed;
  }

  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall bounce (top & bottom of field)
  if (ball.y - ball.radius < field.y) {
    ball.y = field.y + ball.radius;
    ball.vy *= -0.8;
  }
  if (ball.y + ball.radius > field.y + field.h) {
    ball.y = field.y + field.h - ball.radius;
    ball.vy *= -0.8;
  }

  // Left wall (except goal)
  if (ball.x - ball.radius < field.x) {
    if (ball.y < goalLeft.y || ball.y > goalLeft.y + goalLeft.h) {
      ball.x = field.x + ball.radius;
      ball.vx *= -0.8;
    }
  }
  // Right wall (except goal)
  if (ball.x + ball.radius > field.x + field.w) {
    if (ball.y < goalRight.y || ball.y > goalRight.y + goalRight.h) {
      ball.x = field.x + field.w - ball.radius;
      ball.vx *= -0.8;
    }
  }

  // Goal backs
  if (ball.x < goalLeft.x + ball.radius) {
    ball.x = goalLeft.x + ball.radius;
    ball.vx *= -0.5;
  }
  if (ball.x > goalRight.x + goalRight.w - ball.radius) {
    ball.x = goalRight.x + goalRight.w - ball.radius;
    ball.vx *= -0.5;
  }

  // Goal top/bottom walls
  if (ball.x < field.x) {
    if (ball.y - ball.radius < goalLeft.y) {
      ball.y = goalLeft.y + ball.radius;
      ball.vy *= -0.8;
    }
    if (ball.y + ball.radius > goalLeft.y + goalLeft.h) {
      ball.y = goalLeft.y + goalLeft.h - ball.radius;
      ball.vy *= -0.8;
    }
  }
  if (ball.x > field.x + field.w) {
    if (ball.y - ball.radius < goalRight.y) {
      ball.y = goalRight.y + ball.radius;
      ball.vy *= -0.8;
    }
    if (ball.y + ball.radius > goalRight.y + goalRight.h) {
      ball.y = goalRight.y + goalRight.h - ball.radius;
      ball.vy *= -0.8;
    }
  }
}

function checkGoals() {
  // Goal for red (ball in left goal)
  if (ball.x < field.x - 5 && ball.y > goalLeft.y && ball.y < goalLeft.y + goalLeft.h) {
    onGoal('red');
    return true;
  }
  // Goal for blue (ball in right goal)
  if (ball.x > field.x + field.w + 5 && ball.y > goalRight.y && ball.y < goalRight.y + goalRight.h) {
    onGoal('blue');
    return true;
  }
  return false;
}

function onGoal(scoringTeam) {
  if (scoringTeam === 'blue') {
    scoreBlue++;
    spawnGoalParticles(ball.x, ball.y, '#00b4ff');
    document.getElementById('goal-scorer').textContent = 'BLUE BOTS SCORE!';
  } else {
    scoreRed++;
    spawnGoalParticles(ball.x, ball.y, '#ff3d5a');
    document.getElementById('goal-scorer').textContent = 'RED BOTS SCORE!';
  }
  updateHUD();
  gameState = 'goal';
  document.getElementById('goal-overlay').classList.remove('hidden');

  setTimeout(() => {
    document.getElementById('goal-overlay').classList.add('hidden');
    resetEntities();
    if (timeRemaining > 0) {
      gameState = 'playing';
      lastTimestamp = performance.now();
    } else {
      endGame();
    }
  }, CONFIG.goalPause);
}

function endGame() {
  gameState = 'gameover';
  document.getElementById('final-blue').textContent = scoreBlue;
  document.getElementById('final-red').textContent = scoreRed;

  let resultText = 'DRAW!';
  if (scoreBlue > scoreRed) resultText = '🏆 BLUE BOTS WIN! 🏆';
  else if (scoreRed > scoreBlue) resultText = '🏆 RED BOTS WIN! 🏆';
  document.getElementById('result-text').textContent = resultText;

  showScreen('gameover-screen');
}

// ===== ROBOT-BALL COLLISION =====
function robotBallCollision(robot) {
  const d = dist(robot, ball);
  const minDist = robot.radius + ball.radius;
  if (d < minDist && d > 0) {
    // Separation
    const nx = (ball.x - robot.x) / d;
    const ny = (ball.y - robot.y) / d;
    const overlap = minDist - d;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    // Kick force
    const isPlayerControlled = robot.team === 'blue' && robot.index === selectedRobot;
    const force = (isPlayerControlled && boostActive) ? CONFIG.boostKickForce : CONFIG.kickForce;

    // Add robot velocity influence
    ball.vx = nx * force + robot.vx * 0.5;
    ball.vy = ny * force + robot.vy * 0.5;

    spawnKickParticles(ball.x, ball.y);
    return true;
  }
  return false;
}

// ===== ROBOT-ROBOT COLLISION =====
function robotRobotCollision(a, b) {
  const d = dist(a, b);
  const minDist = a.radius + b.radius;
  if (d < minDist && d > 0) {
    const nx = (b.x - a.x) / d;
    const ny = (b.y - a.y) / d;
    const overlap = (minDist - d) / 2;
    a.x -= nx * overlap;
    a.y -= ny * overlap;
    b.x += nx * overlap;
    b.y += ny * overlap;
    // Swap some velocity
    const relVx = a.vx - b.vx;
    const relVy = a.vy - b.vy;
    const dot = relVx * nx + relVy * ny;
    a.vx -= dot * nx * 0.5;
    a.vy -= dot * ny * 0.5;
    b.vx += dot * nx * 0.5;
    b.vy += dot * ny * 0.5;
  }
}

// ===== PLAYER CONTROL =====
function controlPlayer(robot) {
  let dx = 0, dy = 0;
  if (keys['KeyW'] || keys['ArrowUp']) dy = -1;
  if (keys['KeyS'] || keys['ArrowDown']) dy = 1;
  if (keys['KeyA'] || keys['ArrowLeft']) dx = -1;
  if (keys['KeyD'] || keys['ArrowRight']) dx = 1;

  if (dx !== 0 || dy !== 0) {
    const n = normalize(dx, dy);
    const speed = boostActive ? CONFIG.robotSpeed * CONFIG.boostMultiplier : CONFIG.robotSpeed;
    robot.vx = n.x * speed;
    robot.vy = n.y * speed;
    robot.angle = Math.atan2(n.y, n.x);
  } else {
    robot.vx *= CONFIG.robotFriction;
    robot.vy *= CONFIG.robotFriction;
  }
}

// ===== AI =====
function updateAI(robot, team, opponents) {
  const aiSpeed = CONFIG.aiSpeeds[CONFIG.difficulty];
  const reaction = CONFIG.aiReaction[CONFIG.difficulty];

  // Skip some frames for lower difficulty
  if (Math.random() > reaction) {
    robot.vx *= CONFIG.robotFriction;
    robot.vy *= CONFIG.robotFriction;
    return;
  }

  let targetX, targetY;

  if (robot.isGoalkeeper) {
    // Goalkeeper: stay near goal, track ball Y
    const goalCenterX = robot.team === 'blue' ? field.x + 30 : field.x + field.w - 30;
    const goalCenterY = field.y + field.h / 2;
    targetX = goalCenterX;
    targetY = clamp(ball.y, goalCenterY - CONFIG.goalWidth / 2 + 20, goalCenterY + CONFIG.goalWidth / 2 - 20);
  } else {
    const ballDist = dist(robot, ball);
    const isDefensiveSide = (robot.team === 'blue' && ball.x < field.x + field.w * 0.4) ||
                            (robot.team === 'red' && ball.x > field.x + field.w * 0.6);

    if (ballDist < 200 || isDefensiveSide) {
      // Chase ball
      targetX = ball.x;
      targetY = ball.y;

      // Aim towards opponent goal
      if (ballDist < 80) {
        const goalX = robot.team === 'blue' ? field.x + field.w : field.x;
        const goalY = field.y + field.h / 2;
        const toBallX = ball.x - robot.x;
        const toBallY = ball.y - robot.y;
        const toGoalX = goalX - ball.x;
        const toGoalY = goalY - ball.y;
        const toGoalN = normalize(toGoalX, toGoalY);
        // Position behind the ball relative to goal
        targetX = ball.x - toGoalN.x * 30;
        targetY = ball.y - toGoalN.y * 30;
      }
    } else {
      // Return to home position with some offset toward ball
      targetX = lerp(robot.homeX, ball.x, 0.2);
      targetY = lerp(robot.homeY, ball.y, 0.3);
    }
  }

  const dx = targetX - robot.x;
  const dy = targetY - robot.y;
  const d = Math.hypot(dx, dy);

  if (d > 5) {
    const n = normalize(dx, dy);
    robot.vx = n.x * aiSpeed;
    robot.vy = n.y * aiSpeed;
    robot.angle = Math.atan2(n.y, n.x);
  } else {
    robot.vx *= CONFIG.robotFriction;
    robot.vy *= CONFIG.robotFriction;
  }
}

// ===== BLUE TEAM AI (non-selected) =====
function updateBlueAI(robot) {
  const aiSpeed = CONFIG.robotSpeed * 0.85;
  let targetX, targetY;

  if (robot.isGoalkeeper) {
    targetX = field.x + 30;
    targetY = clamp(ball.y, field.y + field.h / 2 - CONFIG.goalWidth / 2 + 20,
                              field.y + field.h / 2 + CONFIG.goalWidth / 2 - 20);
  } else {
    const ballDist = dist(robot, ball);
    if (ballDist < 150 && ball.x < field.x + field.w * 0.5) {
      targetX = ball.x;
      targetY = ball.y;
    } else {
      targetX = lerp(robot.homeX, ball.x, 0.15);
      targetY = lerp(robot.homeY, ball.y, 0.25);
    }
  }

  const dx = targetX - robot.x;
  const dy = targetY - robot.y;
  const d = Math.hypot(dx, dy);

  if (d > 5) {
    const n = normalize(dx, dy);
    robot.vx = n.x * aiSpeed;
    robot.vy = n.y * aiSpeed;
    robot.angle = Math.atan2(n.y, n.x);
  } else {
    robot.vx *= CONFIG.robotFriction;
    robot.vy *= CONFIG.robotFriction;
  }
}

// ===== CONSTRAIN ROBOT TO FIELD =====
function constrainRobot(robot) {
  const r = robot.radius;
  // Allow into own goal area
  const inLeftGoal = robot.x < field.x && robot.y > goalLeft.y && robot.y < goalLeft.y + goalLeft.h;
  const inRightGoal = robot.x > field.x + field.w && robot.y > goalRight.y && robot.y < goalRight.y + goalRight.h;

  if (!inLeftGoal && !inRightGoal) {
    robot.x = clamp(robot.x, field.x + r, field.x + field.w - r);
  }
  robot.y = clamp(robot.y, field.y + r, field.y + field.h - r);
}

// ===== UPDATE =====
function update(dt) {
  if (gameState !== 'playing') return;

  // Timer
  timeRemaining -= dt;
  if (timeRemaining <= 0) {
    timeRemaining = 0;
    endGame();
    return;
  }
  updateHUD();

  // Player control
  if (blueTeam[selectedRobot]) {
    controlPlayer(blueTeam[selectedRobot]);
  }

  // Blue AI (non-selected)
  blueTeam.forEach((robot, i) => {
    if (i !== selectedRobot) {
      updateBlueAI(robot);
    }
  });

  // Red AI
  redTeam.forEach(robot => {
    updateAI(robot, redTeam, blueTeam);
  });

  // Move robots
  const allRobots = [...blueTeam, ...redTeam];
  allRobots.forEach(r => {
    r.x += r.vx;
    r.y += r.vy;
    constrainRobot(r);
    r.eyeBlink = Math.max(0, r.eyeBlink - dt);
    if (Math.random() < 0.003) r.eyeBlink = 0.15;
    r.antennaPhase += dt * 4;
  });

  // Robot-robot collisions
  for (let i = 0; i < allRobots.length; i++) {
    for (let j = i + 1; j < allRobots.length; j++) {
      robotRobotCollision(allRobots[i], allRobots[j]);
    }
  }

  // Ball
  updateBall();

  // Robot-ball collisions
  allRobots.forEach(r => robotBallCollision(r));

  // Check goals
  checkGoals();

  // Particles
  updateParticles(dt);
  updateBallTrail();
}

// ===== DRAWING =====
function drawField() {
  // Grass
  const gradient = ctx.createLinearGradient(field.x, field.y, field.x, field.y + field.h);
  gradient.addColorStop(0, '#1a6e23');
  gradient.addColorStop(0.5, '#1b5e20');
  gradient.addColorStop(1, '#1a6e23');
  ctx.fillStyle = gradient;
  ctx.fillRect(field.x, field.y, field.w, field.h);

  // Grass stripes
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  const stripeW = field.w / 12;
  for (let i = 0; i < 12; i += 2) {
    ctx.fillRect(field.x + i * stripeW, field.y, stripeW, field.h);
  }

  // Field lines
  ctx.strokeStyle = CONFIG.clrFieldLine || 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;

  // Outer border
  ctx.strokeRect(field.x, field.y, field.w, field.h);

  // Center line
  ctx.beginPath();
  ctx.moveTo(field.x + field.w / 2, field.y);
  ctx.lineTo(field.x + field.w / 2, field.y + field.h);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(field.x + field.w / 2, field.y + field.h / 2, 60, 0, Math.PI * 2);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(field.x + field.w / 2, field.y + field.h / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Penalty areas
  const paW = 80, paH = CONFIG.goalWidth + 60;
  const centerY = field.y + field.h / 2;

  ctx.strokeRect(field.x, centerY - paH / 2, paW, paH);
  ctx.strokeRect(field.x + field.w - paW, centerY - paH / 2, paW, paH);

  // Goals
  drawGoal(goalLeft, '#00b4ff');
  drawGoal(goalRight, '#ff3d5a');
}

function drawGoal(goal, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);

  // Net effect
  ctx.fillStyle = color.replace(')', ',0.08)').replace('rgb', 'rgba');
  ctx.fillRect(goal.x, goal.y, goal.w, goal.h);

  ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);
  ctx.setLineDash([]);

  // Goal posts
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(goal.x + goal.w - 3, goal.y - 3, 6, 6);
  ctx.fillRect(goal.x + goal.w - 3, goal.y + goal.h - 3, 6, 6);
}

function drawRobot(robot, isSelected) {
  const { x, y, radius, team, angle, eyeBlink, antennaPhase } = robot;
  const color = team === 'blue' ? '#00b4ff' : '#ff3d5a';
  const colorDark = team === 'blue' ? '#0077aa' : '#aa2244';
  const glowColor = team === 'blue' ? 'rgba(0,180,255,0.3)' : 'rgba(255,61,90,0.3)';

  ctx.save();
  ctx.translate(x, y);

  // Selection ring
  if (isSelected) {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Selection arrow
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(0, -radius - 14);
    ctx.lineTo(-5, -radius - 22);
    ctx.lineTo(5, -radius - 22);
    ctx.closePath();
    ctx.fill();
  }

  // Glow
  const glow = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius * 2);
  glow.addColorStop(0, glowColor);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(-radius * 2, -radius * 2, radius * 4, radius * 4);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(2, radius * 0.6, radius * 0.8, radius * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const bodyGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, radius);
  bodyGrad.addColorStop(0, '#ffffff40');
  bodyGrad.addColorStop(0.3, color);
  bodyGrad.addColorStop(1, colorDark);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // Body outline
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Face (rotated)
  ctx.rotate(angle);

  // Eyes
  const eyeSpacing = 5;
  const eyeOffset = 5;
  if (eyeBlink > 0) {
    // Blink
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(eyeOffset - 2, -eyeSpacing - 1, 4, 2);
    ctx.fillRect(eyeOffset - 2, eyeSpacing - 1, 4, 2);
  } else {
    // Open eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeOffset, -eyeSpacing, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeOffset, eyeSpacing, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(eyeOffset + 1, -eyeSpacing, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeOffset + 1, eyeSpacing, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Antenna
  const antLen = 8;
  const antWave = Math.sin(antennaPhase) * 3;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, -radius + 2);
  ctx.lineTo(-2 + antWave, -radius - antLen);
  ctx.stroke();

  // Antenna tip
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-2 + antWave, -radius - antLen, 2, 0, Math.PI * 2);
  ctx.fill();

  // Jersey number
  ctx.rotate(-angle);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold ${radius * 0.65}px ${getComputedStyle(document.body).fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(robot.index + 1, 0, 1);

  ctx.restore();
}

function drawBall() {
  if (!ball) return;
  const { x, y, radius } = ball;

  // Trail
  trailParticles.forEach(p => {
    const alpha = p.life / p.maxLife * 0.4;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
  });

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + radius * 0.5, radius * 0.8, radius * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ball glow
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > 4) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
    glow.addColorStop(0, `rgba(255,215,0,${Math.min(0.3, speed * 0.02)})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ball body
  const ballGrad = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, radius);
  ballGrad.addColorStop(0, '#ffffff');
  ballGrad.addColorStop(0.7, '#e8e8e8');
  ballGrad.addColorStop(1, '#cccccc');
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Ball pattern (pentagon shapes)
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + performance.now() * 0.001;
    const px = x + Math.cos(a) * radius * 0.5;
    const py = y + Math.sin(a) * radius * 0.5;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawParticles() {
  particles.forEach(p => {
    const alpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawSelectedIndicator() {
  const robot = blueTeam[selectedRobot];
  if (!robot) return;

  // Direction indicator from robot toward ball
  const dx = ball.x - robot.x;
  const dy = ball.y - robot.y;
  const d = Math.hypot(dx, dy);
  if (d > robot.radius + ball.radius + 10) {
    const angle = Math.atan2(dy, dx);
    const arrowDist = robot.radius + 12;
    const ax = robot.x + Math.cos(angle) * arrowDist;
    const ay = robot.y + Math.sin(angle) * arrowDist;
    ctx.fillStyle = 'rgba(255,215,0,0.4)';
    ctx.beginPath();
    ctx.arc(ax, ay, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw() {
  // Clear
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (gameState === 'menu') return;

  drawField();
  drawBall();

  // Draw robots
  blueTeam.forEach((r, i) => drawRobot(r, i === selectedRobot));
  redTeam.forEach(r => drawRobot(r, false));

  drawSelectedIndicator();
  drawParticles();
}

// ===== GAME LOOP =====
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;

  if (gameState === 'playing') {
    update(dt);
  } else if (gameState === 'goal') {
    updateParticles(dt);
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// ===== INIT ON LOAD =====
window.addEventListener('DOMContentLoaded', initGame);
