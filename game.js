const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const uiBlue = document.getElementById('blueScore');
const uiRed = document.getElementById('redScore');
const uiHint = document.getElementById('hint');

const TEAM = { BLUE: 'blue', RED: 'red', NEUTRAL: 'neutral' };
const C = {
  bg: '#141b23',
  grid: '#1f2b36',
  text: '#d8e3ef',
  blue: '#4aa8ff',
  blue2: '#88c9ff',
  red: '#ff6565',
  red2: '#ff9f9f',
  neutral: '#b7bdc7',
  bulletBlue: '#8dd3ff',
  bulletRed: '#ffb6b6',
  factory: '#35414f',
};

const rand = (a, b) => Math.random() * (b - a) + a;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

class Unit {
  constructor(team, x, y) {
    this.team = team;
    this.x = x;
    this.y = y;
    this.r = 8;
    this.hp = 100;
    this.maxHp = 100;
    this.speed = 92; // px/s
    this.targetPos = null;
    this.targetUnit = null;
    this.attackRange = 110;
    this.fireCd = 0;
    this.selected = false;
    this.aiWanderCd = rand(0.4, 1.8);
  }

  isEnemy(other) {
    return other && other.hp > 0 && other.team !== this.team;
  }

  setMove(x, y) {
    this.targetPos = { x: clamp(x, 12, W - 12), y: clamp(y, 12, H - 12) };
    this.targetUnit = null;
  }

  setAttack(unit) {
    this.targetUnit = unit;
    this.targetPos = null;
  }

  update(dt, game) {
    if (this.hp <= 0) return;
    this.fireCd = Math.max(0, this.fireCd - dt);

    if (this.targetUnit && this.targetUnit.hp <= 0) this.targetUnit = null;

    // Simple AI for red team + idle blue units
    if (!this.selected && !this.targetUnit && !this.targetPos) {
      this.aiWanderCd -= dt;
      if (this.aiWanderCd <= 0) {
        this.aiWanderCd = rand(1.0, 2.4);
        const objective = game.getObjectiveFor(this.team);
        if (objective) this.setMove(objective.x + rand(-30, 30), objective.y + rand(-30, 30));
      }
    }

    // Auto acquire nearest enemy in range-ish
    if (!this.targetUnit) {
      let best = null;
      let bestD = 180 * 180;
      for (const u of game.units) {
        if (!this.isEnemy(u)) continue;
        const d = dist2(this, u);
        if (d < bestD) {
          bestD = d;
          best = u;
        }
      }
      if (best) this.targetUnit = best;
    }

    if (this.targetUnit) {
      const d2 = dist2(this, this.targetUnit);
      const inRange = d2 <= this.attackRange * this.attackRange;
      if (!inRange) {
        this.moveToward(this.targetUnit.x, this.targetUnit.y, dt);
      } else if (this.fireCd <= 0) {
        this.fireCd = 0.48;
        const dmg = 10 + Math.floor(Math.random() * 4);
        game.bullets.push(new Bullet(this, this.targetUnit, dmg));
      }
      return;
    }

    if (this.targetPos) {
      const dx = this.targetPos.x - this.x;
      const dy = this.targetPos.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) {
        this.targetPos = null;
      } else {
        this.x += (dx / d) * this.speed * dt;
        this.y += (dy / d) * this.speed * dt;
      }
    }

    this.x = clamp(this.x, this.r, W - this.r);
    this.y = clamp(this.y, this.r, H - this.r);
  }

  moveToward(tx, ty, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.x += (dx / d) * this.speed * dt;
    this.y += (dy / d) * this.speed * dt;
  }

  draw() {
    const col = this.team === TEAM.BLUE ? C.blue : C.red;
    const col2 = this.team === TEAM.BLUE ? C.blue2 : C.red2;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = '#0b1117';
    ctx.lineWidth = 1;
    ctx.stroke();

    // HP bar
    ctx.fillStyle = '#0008';
    ctx.fillRect(this.x - 12, this.y - 16, 24, 4);
    ctx.fillStyle = col2;
    ctx.fillRect(this.x - 12, this.y - 16, (24 * this.hp) / this.maxHp, 4);

    if (this.selected) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

class Bullet {
  constructor(from, target, dmg) {
    this.team = from.team;
    this.x = from.x;
    this.y = from.y;
    this.target = target;
    this.dmg = dmg;
    this.speed = 420;
    this.dead = false;
  }

  update(dt) {
    if (!this.target || this.target.hp <= 0) {
      this.dead = true;
      return;
    }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const step = this.speed * dt;
    if (d <= step) {
      this.target.hp -= this.dmg;
      this.dead = true;
      return;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = this.team === TEAM.BLUE ? C.bulletBlue : C.bulletRed;
    ctx.fill();
  }
}

class Flag {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.owner = TEAM.NEUTRAL;
    this.capture = 0; // -100 red ... +100 blue
    this.radius = 52;
  }

  update(dt, units) {
    let b = 0;
    let r = 0;
    const rr = this.radius * this.radius;
    for (const u of units) {
      if (u.hp <= 0) continue;
      if (dist2(u, this) <= rr) {
        if (u.team === TEAM.BLUE) b++;
        else r++;
      }
    }

    if (b !== r) {
      this.capture += (b - r) * 28 * dt;
      this.capture = clamp(this.capture, -100, 100);
    }

    if (this.capture >= 100) this.owner = TEAM.BLUE;
    else if (this.capture <= -100) this.owner = TEAM.RED;
    else if (Math.abs(this.capture) < 5 && b === 0 && r === 0) this.owner = TEAM.NEUTRAL;
  }

  draw() {
    // zone
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff1f';
    ctx.lineWidth = 1;
    ctx.stroke();

    // pole
    ctx.strokeStyle = '#d5dbe3';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + 16);
    ctx.lineTo(this.x, this.y - 16);
    ctx.stroke();

    const col = this.owner === TEAM.BLUE ? C.blue : this.owner === TEAM.RED ? C.red : C.neutral;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - 16);
    ctx.lineTo(this.x + 22, this.y - 8);
    ctx.lineTo(this.x, this.y);
    ctx.closePath();
    ctx.fill();

    // capture bar
    ctx.fillStyle = '#0008';
    ctx.fillRect(this.x - 24, this.y + 22, 48, 5);
    if (this.capture >= 0) {
      ctx.fillStyle = C.blue;
      ctx.fillRect(this.x, this.y + 22, (this.capture / 100) * 24, 5);
    } else {
      ctx.fillStyle = C.red;
      ctx.fillRect(this.x + (this.capture / 100) * 24, this.y + 22, Math.abs((this.capture / 100) * 24), 5);
    }
  }
}

class Factory {
  constructor(team, x, y) {
    this.team = team;
    this.x = x;
    this.y = y;
    this.spawnCd = 1.0;
  }

  update(dt, game) {
    this.spawnCd -= dt;
    if (this.spawnCd <= 0) {
      this.spawnCd = 4.2;
      // cap total to avoid lag
      const countTeam = game.units.filter((u) => u.team === this.team && u.hp > 0).length;
      if (countTeam < 45) {
        game.units.push(new Unit(this.team, this.x + rand(-16, 16), this.y + rand(-16, 16)));
      }
    }
  }

  draw() {
    ctx.fillStyle = C.factory;
    ctx.fillRect(this.x - 22, this.y - 22, 44, 44);
    ctx.strokeStyle = this.team === TEAM.BLUE ? C.blue : C.red;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - 22, this.y - 22, 44, 44);

    ctx.fillStyle = this.team === TEAM.BLUE ? C.blue : C.red;
    ctx.fillRect(this.x - 8, this.y - 8, 16, 16);
  }
}

class Game {
  constructor() {
    this.units = [];
    this.flags = [new Flag(330, 190), new Flag(600, 350), new Flag(870, 510)];
    this.factories = [new Factory(TEAM.BLUE, 95, 350), new Factory(TEAM.RED, 1105, 350)];
    this.bullets = [];

    this.selected = null;
    this.blueTickets = 200;
    this.redTickets = 200;
    this.gameOver = false;

    for (let i = 0; i < 8; i++) {
      this.units.push(new Unit(TEAM.BLUE, 120 + rand(-28, 24), 350 + rand(-40, 40)));
      this.units.push(new Unit(TEAM.RED, 1080 + rand(-24, 28), 350 + rand(-40, 40)));
    }

    this.bindInput();
  }

  bindInput() {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (e.button === 0) {
        this.selected = null;
        for (const u of this.units) u.selected = false;

        let best = null;
        let bestD = 99999;
        for (const u of this.units) {
          if (u.team !== TEAM.BLUE || u.hp <= 0) continue;
          const d = dist2({ x, y }, u);
          if (d < (u.r + 7) * (u.r + 7) && d < bestD) {
            bestD = d;
            best = u;
          }
        }
        if (best) {
          this.selected = best;
          best.selected = true;
        }
      }

      if (e.button === 2 && this.selected && this.selected.hp > 0) {
        let enemy = null;
        let bestD = 999999;
        for (const u of this.units) {
          if (u.team === TEAM.BLUE || u.hp <= 0) continue;
          const d = dist2({ x, y }, u);
          if (d < (u.r + 8) * (u.r + 8) && d < bestD) {
            bestD = d;
            enemy = u;
          }
        }
        if (enemy) this.selected.setAttack(enemy);
        else this.selected.setMove(x, y);
      }
    });
  }

  getObjectiveFor(team) {
    // Priority: neutral flag -> enemy-owned flag -> middle
    const own = team;
    const neutral = this.flags.find((f) => f.owner === TEAM.NEUTRAL);
    if (neutral) return neutral;

    const enemy = this.flags.find((f) => f.owner !== own);
    if (enemy) return enemy;

    return { x: W / 2, y: H / 2 };
  }

  update(dt) {
    if (this.gameOver) return;

    for (const f of this.factories) f.update(dt, this);
    for (const fl of this.flags) fl.update(dt, this.units);

    // Ticket drain by flag control (Z-like domination)
    const blueOwned = this.flags.filter((f) => f.owner === TEAM.BLUE).length;
    const redOwned = this.flags.filter((f) => f.owner === TEAM.RED).length;
    if (blueOwned > redOwned) this.redTickets = Math.max(0, this.redTickets - (blueOwned - redOwned) * dt * 2.4);
    if (redOwned > blueOwned) this.blueTickets = Math.max(0, this.blueTickets - (redOwned - blueOwned) * dt * 2.4);

    for (const u of this.units) u.update(dt, this);
    this.units = this.units.filter((u) => u.hp > 0);

    for (const b of this.bullets) b.update(dt);
    this.bullets = this.bullets.filter((b) => !b.dead);

    if (this.blueTickets <= 0 || this.redTickets <= 0) {
      this.gameOver = true;
      const winner = this.blueTickets > this.redTickets ? 'Синие победили!' : 'Красные победили!';
      uiHint.textContent = `${winner} Нажми F5 для рестарта`;
    }

    uiBlue.textContent = `${Math.ceil(this.blueTickets)} (${blueOwned} флага)`;
    uiRed.textContent = `${Math.ceil(this.redTickets)} (${redOwned} флага)`;
  }

  drawGrid() {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  draw() {
    this.drawGrid();

    for (const fl of this.flags) fl.draw();
    for (const f of this.factories) f.draw();
    for (const u of this.units) u.draw();
    for (const b of this.bullets) b.draw();
  }
}

const game = new Game();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
