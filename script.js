const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score-val');
const highScoreEl = document.getElementById('high-score-val');
const healthBar = document.getElementById('health-bar-fill');
const overlay = document.getElementById('overlay');
const gameOverScreen = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const powerupNotice = document.getElementById('powerup-notice');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const levelEl = document.getElementById('level-val');

// Game State
let gameRunning = false;
let score = 0;
let highScore = localStorage.getItem('neonStrikeHighScore') || 0;
let level = 1;
let health = 100;
let frameCount = 0;
let enemies = [];
let projectiles = [];
let particles = [];
let stars = [];
let powerups = [];

// Configuration
const CONFIG = {
    player: {
        speed: 8,
        size: 40,
        fireRate: 8,
    },
    enemy: {
        spawnRate: 60,
        baseSpeed: 2,
    },
    levelRequirement: 5000,
    powerup: {
        spawnRate: 600, // Every ~10 seconds
        duration: 500, // Frames
    },
    colors: {
        neonBlue: '#00f3ff',
        neonPurple: '#bc13fe',
        neonPink: '#ff00ff',
        gold: '#ffd700',
    }
};

highScoreEl.innerText = highScore.toString().padStart(5, '0');

// Input Handling
const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2, moved: false, isPressed: false };

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.moved = true;
});

window.addEventListener('mousedown', () => mouse.isPressed = true);
window.addEventListener('mouseup', () => mouse.isPressed = false);

// Resizing
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (!mouse.moved) {
        mouse.x = canvas.width / 2;
        mouse.y = canvas.height - 100;
    }
}
window.addEventListener('resize', resize);
resize();

// Classes
class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height - 100;
        this.width = CONFIG.player.size;
        this.height = CONFIG.player.size;
        this.lastShot = 0;
        this.powerMode = null; // 'triple', 'rapid', 'shield'
        this.powerTimer = 0;
        this.shieldActive = false;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Shield Effect
        if (this.shieldActive) {
            ctx.beginPath();
            ctx.arc(0, 0, this.width * 1.2, 0, Math.PI * 2);
            ctx.strokeStyle = CONFIG.colors.neonBlue;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.shadowBlur = 20;
            ctx.shadowColor = CONFIG.colors.neonBlue;
        }

        // Neon Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = CONFIG.colors.neonBlue;

        // Ship Body
        ctx.fillStyle = CONFIG.colors.neonBlue;
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2);
        ctx.lineTo(this.width / 2, this.height / 2);
        ctx.lineTo(-this.width / 2, this.height / 2);
        ctx.closePath();
        ctx.fill();

        // Cockpit
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(0, this.height / 6, this.width / 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    update() {
        // Keyboard movement
        if (keys['ArrowLeft'] || keys['KeyA']) { this.x -= CONFIG.player.speed; mouse.moved = false; }
        if (keys['ArrowRight'] || keys['KeyD']) { this.x += CONFIG.player.speed; mouse.moved = false; }
        if (keys['ArrowUp'] || keys['KeyW']) { this.y -= CONFIG.player.speed; mouse.moved = false; }
        if (keys['ArrowDown'] || keys['KeyS']) { this.y += CONFIG.player.speed; mouse.moved = false; }

        // Mouse following (Smooth)
        if (mouse.moved) {
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            this.x += dx * 0.15; // Smooth interpolation
            this.y += dy * 0.15;
        }

        // Bounds
        this.x = Math.max(this.width / 2, Math.min(canvas.width - this.width / 2, this.x));
        this.y = Math.max(this.height / 2, Math.min(canvas.height - this.height / 2, this.y));

        // Powerup logic
        if (this.powerTimer > 0) {
            this.powerTimer--;
            if (this.powerTimer === 0) {
                this.powerMode = null;
                this.shieldActive = false;
                powerupNotice.classList.remove('active');
            }
        }

        // Shooting
        let currentFireRate = this.powerMode === 'rapid' ? 4 : CONFIG.player.fireRate;
        if ((keys['Space'] || mouse.isPressed) && frameCount - this.lastShot >= currentFireRate) {
            this.shoot();
            this.lastShot = frameCount;
        }
    }

    shoot() {
        if (this.powerMode === 'triple') {
            projectiles.push(new Projectile(this.x, this.y - this.height / 2, 0));
            projectiles.push(new Projectile(this.x, this.y - this.height / 2, -0.5));
            projectiles.push(new Projectile(this.x, this.y - this.height / 2, 0.5));
        } else {
            projectiles.push(new Projectile(this.x, this.y - this.height / 2, 0));
        }
    }

    activatePowerup(type) {
        this.powerMode = type;
        this.powerTimer = CONFIG.powerup.duration;
        if (type === 'shield') this.shieldActive = true;

        powerupNotice.innerText = `${type.toUpperCase()} ACTIVATED!`;
        powerupNotice.classList.add('active');
    }
}

class Projectile {
    constructor(x, y, vx = 0) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.speed = 12;
        this.radius = 4;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.colors.neonBlue;
        ctx.fillStyle = CONFIG.colors.neonBlue;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.y -= this.speed;
        this.x += this.vx;
    }
}

class Enemy {
    constructor(isBoss = false) {
        this.isBoss = isBoss;
        this.width = isBoss ? 120 : 40;
        this.height = isBoss ? 120 : 40;
        this.x = Math.random() * (canvas.width - this.width) + this.width / 2;
        this.y = -this.height;
        this.speed = isBoss ? 1 : (CONFIG.enemy.baseSpeed + (level * 0.5));
        this.color = isBoss ? CONFIG.colors.neonPurple : (Math.random() > 0.5 ? CONFIG.colors.neonPurple : CONFIG.colors.neonPink);
        this.health = isBoss ? (15 + level * 5) : 1;
        this.maxHealth = this.health;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(frameCount * (this.isBoss ? 0.02 : 0.05));

        ctx.shadowBlur = this.isBoss ? 30 : 15;
        ctx.shadowColor = this.color;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        const sides = this.isBoss ? 12 : 6;
        for (let i = 0; i < sides; i++) {
            ctx.lineTo(Math.cos(i * Math.PI * 2 / sides) * this.width / 2, Math.sin(i * Math.PI * 2 / sides) * this.height / 2);
        }
        ctx.closePath();
        ctx.fill();

        if (this.isBoss) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 4, 0, Math.PI * 2);
            ctx.fill();

            const barW = 100;
            const barH = 5;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(-barW / 2, -this.height / 2 - 20, barW, barH);
            ctx.fillStyle = CONFIG.colors.neonPink;
            ctx.fillRect(-barW / 2, -this.height / 2 - 20, barW * (this.health / this.maxHealth), barH);
        }

        ctx.restore();
    }

    update() {
        this.y += this.speed;
        if (this.isBoss) {
            this.x += Math.sin(frameCount * 0.02) * 4;
        } else {
            this.x += Math.sin(frameCount * 0.05 + this.x) * 2;
        }
    }
}

class PowerUp {
    constructor() {
        this.types = ['triple', 'rapid', 'shield'];
        this.type = this.types[Math.floor(Math.random() * this.types.length)];
        this.x = Math.random() * (canvas.width - 40) + 20;
        this.y = -40;
        this.speed = 3;
        this.size = 30;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = CONFIG.colors.gold;
        ctx.fillStyle = CONFIG.colors.gold;
        ctx.font = 'bold 20px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('P', this.x, this.y);

        ctx.beginPath();
        ctx.arc(this.x, this.y - 7, this.size / 2, 0, Math.PI * 2);
        ctx.strokeStyle = CONFIG.colors.gold;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    update() {
        this.y += this.speed;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 1;
        this.vx = (Math.random() - 0.5) * 15;
        this.vy = (Math.random() - 0.5) * 15;
        this.life = 1.0;
        this.decay = Math.random() * 0.01 + 0.01;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.vx *= 0.96; // Friction
        this.vy *= 0.96;
    }
}

class Star {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speed = Math.random() * 1.5 + 0.5;
        this.brightness = Math.random();
        this.twinkleSpeed = Math.random() * 0.02;
        this.color = Math.random() > 0.8 ? (Math.random() > 0.5 ? '#fffae6' : '#e6f2ff') : '#ffffff';
    }

    update() {
        this.y += this.speed;
        this.brightness += this.twinkleSpeed;
        if (this.y > canvas.height) {
            this.y = 0;
            this.x = Math.random() * canvas.width;
        }
    }

    draw() {
        const alpha = 0.3 + Math.abs(Math.sin(this.brightness)) * 0.7;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class Nebula {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.radius = Math.random() * 300 + 200;
        this.color = Math.random() > 0.5 ? 'rgba(188, 19, 254, 0.05)' : 'rgba(0, 243, 255, 0.05)';
        this.speed = 0.2;
    }

    update() {
        this.y += this.speed;
        if (this.y - this.radius > canvas.height) {
            this.y = -this.radius;
            this.x = Math.random() * canvas.width;
        }
    }

    draw() {
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Initialization and Main Loop
let player = new Player();
let nebulas = [];

function initStars() {
    stars = [];
    nebulas = [];
    for (let i = 0; i < 150; i++) stars.push(new Star());
    for (let i = 0; i < 3; i++) nebulas.push(new Nebula());
}

function resetGame() {
    score = 0;
    level = 1;
    levelEl.innerText = '1';
    health = 100;
    enemies = [];
    projectiles = [];
    particles = [];
    powerups = [];
    frameCount = 0;
    scoreEl.innerText = '00000';
    healthBar.style.width = '100%';
    player = new Player();
    powerupNotice.classList.remove('active');
}

function gameLoop() {
    if (!gameRunning) return;

    // Reset shadow for background clear
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.fillStyle = 'rgba(5, 5, 5, 0.3)'; // Motion blur trail
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cosmic Background
    nebulas.forEach(n => {
        n.update();
        n.draw();
    });

    stars.forEach(star => {
        star.update();
        star.draw();
    });

    // Player
    player.update();
    player.draw();

    // Spawning Enemies
    const dynamicSpawnRate = Math.max(10, CONFIG.enemy.spawnRate - (level * 5));
    if (frameCount % dynamicSpawnRate === 0) {
        enemies.push(new Enemy());
    }

    // Boss Spawn every 10000 points
    const hasBoss = enemies.some(e => e.isBoss);
    if (score > 0 && score % 10000 < 200 && !hasBoss && frameCount % 60 === 0) {
        enemies.push(new Enemy(true));
    }

    // Spawning Powerups
    if (frameCount % CONFIG.powerup.spawnRate === 0 && Math.random() > 0.5) {
        powerups.push(new PowerUp());
    }

    // Powerups logic
    powerups.forEach((p, pIdx) => {
        p.update();
        p.draw();

        // Collection
        const dist = Math.hypot(p.x - player.x, p.y - player.y);
        if (dist < (p.size + player.width / 2)) {
            player.activatePowerup(p.type);
            powerups.splice(pIdx, 1);
            createExplosion(p.x, p.y, CONFIG.colors.gold, 30);
        }

        if (p.y > canvas.height) powerups.splice(pIdx, 1);
    });

    // Projectiles
    projectiles.forEach((p, pIdx) => {
        p.update();
        p.draw();
        if (p.y < 0 || p.x < 0 || p.x > canvas.width) projectiles.splice(pIdx, 1);
    });

    // Enemies
    enemies.forEach((e, eIdx) => {
        e.update();
        e.draw();

        if (e.y > canvas.height + e.height) {
            enemies.splice(eIdx, 1);
            if (!player.shieldActive && !e.isBoss) takeDamage(10);
            if (e.isBoss) takeDamage(50);
        }

        // Collision with Player
        const distToPlayer = Math.hypot(e.x - player.x, e.y - player.y);
        if (distToPlayer < (e.width / 2 + player.width / 2)) {
            if (!player.shieldActive) {
                enemies.splice(eIdx, 1);
                createExplosion(e.x, e.y, e.color, 40);
                takeDamage(e.isBoss ? 50 : 20);
            } else {
                if (!e.isBoss) {
                    enemies.splice(eIdx, 1);
                    createExplosion(e.x, e.y, e.color, 20);
                }
            }
        }

        // Collision with Projectiles
        projectiles.forEach((p, pIdx) => {
            const dist = Math.hypot(e.x - p.x, e.y - p.y);
            if (dist < (e.width / 2 + p.radius)) {
                e.health--;
                projectiles.splice(pIdx, 1);
                createExplosion(p.x, p.y, e.color, 5);

                if (e.health <= 0) {
                    createExplosion(e.x, e.y, e.color, e.isBoss ? 100 : 20);
                    enemies.splice(eIdx, 1);
                    addScore(e.isBoss ? 2000 : 100);
                }
            }
        });
    });

    // Particles
    particles.forEach((p, pIdx) => {
        p.update();
        p.draw();
        if (p.life <= 0) particles.splice(pIdx, 1);
    });

    frameCount++;
    requestAnimationFrame(gameLoop);
}

// Helpers
function takeDamage(amount) {
    if (player.shieldActive) return;

    health -= amount;
    healthBar.style.width = `${Math.max(0, health)}%`;

    // Screen Shake
    canvas.classList.add('shake');
    setTimeout(() => canvas.classList.remove('shake'), 200);

    if (health <= 0) endGame();
}

function addScore(amount) {
    score += amount;
    scoreEl.innerText = score.toString().padStart(5, '0');
    if (score > highScore) {
        highScore = score;
        highScoreEl.innerText = highScore.toString().padStart(5, '0');
        localStorage.setItem('neonStrikeHighScore', highScore);
    }

    // Level Up logic
    const newLevel = Math.floor(score / CONFIG.levelRequirement) + 1;
    if (newLevel > level) {
        level = newLevel;
        levelEl.innerText = level;
        powerupNotice.innerText = `LEVEL ${level} REACHED!`;
        powerupNotice.classList.add('active');
        setTimeout(() => powerupNotice.classList.remove('active'), 2000);
    }
}

function createExplosion(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function endGame() {
    gameRunning = false;
    gameOverScreen.classList.remove('hidden');
    finalScoreEl.innerText = score;
}

// Events
startBtn.addEventListener('click', () => {
    overlay.classList.remove('active');
    overlay.classList.add('hidden');
    gameRunning = true;
    initStars();
    resetGame();
    gameLoop();
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    gameRunning = true;
    resetGame();
    gameLoop();
});

initStars();
