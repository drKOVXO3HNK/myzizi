const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const uiBlue = document.getElementById('blueScore');
const uiRed = document.getElementById('redScore');
const uiHint = document.getElementById('hint');
const pauseBtn = document.getElementById('pauseBtn');

const TEAM = { BLUE: 'blue', RED: 'red', NEUTRAL: 'neutral' };

const C = {
  blue: '#49b0ff',
  blueSoft: '#89d0ff',
  red: '#ff6666',
  redSoft: '#ffb2b2',
  neutral: '#c2c8cf',
  road: '#2e3741',
  roadLine: '#495462',
  shellBlue: '#b5e5ff',
  shellRed: '#ffd1d1',
};

const BIOMES = {
  desert: { top: '#2b261f', bottom: '#1f1b15', tint: '#7d6a47aa' },
  snow: { top: '#233040', bottom: '#18222f', tint: '#98b7d699' },
  volcanic: { top: '#2a1d1d', bottom: '#191111', tint: '#8f4d4daa' },
  swamp: { top: '#1c2a1d', bottom: '#121b12', tint: '#4d8f5faa' },
  city: { top: '#1d232c', bottom: '#11161e', tint: '#6b7a8faa' },
};

const rand = (a, b) => Math.random() * (b - a) + a;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const d2 = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

const imgSoldierBlue = new Image();
imgSoldierBlue.src = './assets/soldier_blue.png';
const imgSoldierRed = new Image();
imgSoldierRed.src = './assets/soldier_red.png';
const imgTankBlue = new Image();
imgTankBlue.src = './assets/tank_blue.png';
const imgTankRed = new Image();
imgTankRed.src = './assets/tank_red.png';

class Sector {
  constructor(id, x, y, w, h, hasFactory = false, hasGarage = false, biome = 'city') {
    this.id = id;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.cx = x + w / 2;
    this.cy = y + h / 2;
    this.owner = TEAM.NEUTRAL;
    this.capture = 0;
    this.hasFactory = hasFactory;
    this.hasGarage = hasGarage;
    this.biome = biome;
  }

  contains(x, y) {
    return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h;
  }

  update(dt, units) {
    let blue = 0;
    let red = 0;
    for (const u of units) {
      if (u.hp <= 0) continue;
      if (this.contains(u.x, u.y)) {
        if (u.team === TEAM.BLUE) blue++;
        else if (u.team === TEAM.RED) red++;
      }
    }

    if (blue !== red) this.capture = clamp(this.capture + (blue - red) * 22 * dt, -100, 100);

    if (this.capture >= 100) this.owner = TEAM.BLUE;
    else if (this.capture <= -100) this.owner = TEAM.RED;
    else if (Math.abs(this.capture) < 3 && blue === 0 && red === 0) this.owner = TEAM.NEUTRAL;
  }

  draw() {
    const biomeTint = BIOMES[this.biome].tint;
    ctx.fillStyle = biomeTint;
    ctx.fillRect(this.x + 1, this.y + 1, this.w - 2, this.h - 2);

    const ownerTint = this.owner === TEAM.BLUE ? '#13365480' : this.owner === TEAM.RED ? '#5b232380' : '#2b344140';
    ctx.fillStyle = ownerTint;
    ctx.fillRect(this.x + 1, this.y + 1, this.w - 2, this.h - 2);

    ctx.strokeStyle = '#ffffff1f';
    ctx.strokeRect(this.x, this.y, this.w, this.h);

    const fx = this.cx;
    const fy = this.cy - 8;
    ctx.strokeStyle = '#dce5f0bb';
    ctx.beginPath();
    ctx.moveTo(fx, fy + 16);
    ctx.lineTo(fx, fy - 16);
    ctx.stroke();

    const flagCol = this.owner === TEAM.BLUE ? C.blue : this.owner === TEAM.RED ? C.red : C.neutral;
    ctx.fillStyle = flagCol;
    ctx.beginPath();
    ctx.moveTo(fx, fy - 16);
    ctx.lineTo(fx + 18, fy - 10);
    ctx.lineTo(fx, fy - 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#000a';
    ctx.fillRect(this.cx - 26, this.cy + 22, 52, 6);
    if (this.capture >= 0) {
      ctx.fillStyle = C.blue;
      ctx.fillRect(this.cx, this.cy + 22, (this.capture / 100) * 26, 6);
    } else {
      ctx.fillStyle = C.red;
      const w = Math.abs((this.capture / 100) * 26);
      ctx.fillRect(this.cx - w, this.cy + 22, w, 6);
    }

    if (this.hasFactory || this.hasGarage) {
      const txt = `${this.hasFactory ? 'FACTORY' : ''}${this.hasFactory && this.hasGarage ? ' + ' : ''}${this.hasGarage ? 'GARAGE' : ''}`;
      ctx.fillStyle = '#d9e3efcc';
      ctx.font = '10px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText(txt, this.cx, this.y + 14);
      ctx.textAlign = 'start';
    }
  }
}

class Base {
  constructor(team, x, y) {
    this.team = team;
    this.x = x;
    this.y = y;
    this.w = 86;
    this.h = 86;
    this.maxHp = 3200;
    this.hp = this.maxHp;
    this.guardCd = 0;
  }

  update(dt, game) {
    this.guardCd -= dt;
    if (this.guardCd <= 0) {
      this.guardCd = 5;
      const own = game.units.filter(u => u.team === this.team && u.hp > 0).length;
      if (own < 90) game.units.push(new Unit(this.team, this.x + rand(-20, 20), this.y + rand(-18, 18), 'infantry'));
    }
  }

  draw() {
    ctx.fillStyle = '#3b4450';
    ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);

    ctx.lineWidth = 3;
    ctx.strokeStyle = this.team === TEAM.BLUE ? C.blue : C.red;
    ctx.strokeRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);

    ctx.fillStyle = '#000b';
    ctx.fillRect(this.x - 34, this.y - this.h / 2 - 12, 68, 6);
    ctx.fillStyle = this.team === TEAM.BLUE ? C.blueSoft : C.redSoft;
    ctx.fillRect(this.x - 34, this.y - this.h / 2 - 12, 68 * (this.hp / this.maxHp), 6);

    ctx.fillStyle = '#eef4ff';
    ctx.font = '11px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(this.team === TEAM.BLUE ? 'BLUE FORT' : 'RED FORT', this.x, this.y + 4);
    ctx.textAlign = 'start';
  }
}

class NeutralVehicle {
  constructor(x, y, type = 'tank') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.r = 16;
    this.hp = 1;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = '#d3d7df';
    ctx.beginPath();
    ctx.arc(0, 0, this.r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#303846';
    ctx.fillRect(-16, -8, 32, 16);
    ctx.strokeStyle = '#d0d6df';
    ctx.strokeRect(-16, -8, 32, 16);

    ctx.fillStyle = '#ecf3ff';
    ctx.font = '10px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('NEUTRAL', 0, -15);
    ctx.restore();
  }
}

class Turret {
  constructor(sector) {
    this.sector = sector;
    this.x = sector.cx;
    this.y = sector.cy - 34;
    this.range = 180;
    this.cooldown = 0.7;
    this.cool = rand(0, 0.6);
    this.hp = 9999;
  }

  update(dt, game) {
    this.cool -= dt;
    if (this.sector.owner === TEAM.NEUTRAL) return;
    if (this.cool > 0) return;

    let best = null;
    let bestD = this.range * this.range;
    for (const u of game.units) {
      if (u.hp <= 0 || u.team === this.sector.owner) continue;
      const dd = d2(this, u);
      if (dd < bestD) {
        bestD = dd;
        best = u;
      }
    }

    if (best) {
      this.cool = this.cooldown;
      game.projectiles.push(new Projectile({
        team: this.sector.owner,
        type: 'turret',
        x: this.x,
        y: this.y,
      }, best, Math.floor(rand(12, 18))));
    }
  }

  draw() {
    const own = this.sector.owner;
    const col = own === TEAM.BLUE ? C.blue : own === TEAM.RED ? C.red : '#7f8b97';

    ctx.fillStyle = '#26303b';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = col;
    ctx.fillRect(this.x - 2, this.y - 14, 4, 12);
  }
}

class Particle {
  constructor(x, y, col) {
    this.x = x;
    this.y = y;
    this.vx = rand(-90, 90);
    this.vy = rand(-90, 90);
    this.life = rand(0.2, 0.6);
    this.maxLife = this.life;
    this.col = col;
    this.dead = false;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw() {
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.fillStyle = this.col;
    ctx.fillRect(this.x, this.y, 2, 2);
    ctx.globalAlpha = 1;
  }
}

class Unit {
  constructor(team, x, y, type = 'infantry') {
    this.team = team;
    this.x = x;
    this.y = y;
    this.type = type;

    if (type === 'tank') {
      this.r = 12;
      this.maxHp = 290;
      this.hp = this.maxHp;
      this.speed = 70;
      this.range = 170;
      this.cooldown = 0.9;
      this.minDmg = 24;
      this.maxDmg = 33;
    } else if (type === 'rocketeer') {
      this.r = 8;
      this.maxHp = 90;
      this.hp = this.maxHp;
      this.speed = 88;
      this.range = 155;
      this.cooldown = 1.05;
      this.minDmg = 18;
      this.maxDmg = 26;
    } else {
      this.r = 8;
      this.maxHp = 115;
      this.hp = this.maxHp;
      this.speed = 96;
      this.range = 118;
      this.cooldown = 0.48;
      this.minDmg = 10;
      this.maxDmg = 15;
    }

    this.targetPos = null;
    this.targetEntity = null;
    this.cool = rand(0, 0.3);
    this.selected = false;
    this.heading = 0;
    this.aiCd = rand(0.4, 1.1);
  }

  setMove(x, y) {
    this.targetPos = { x: clamp(x, 10, W - 10), y: clamp(y, 10, H - 10) };
    this.targetEntity = null;
  }

  setAttack(entity) {
    this.targetEntity = entity;
    this.targetPos = null;
  }

  update(dt, game) {
    this.cool = Math.max(0, this.cool - dt);
    if (this.targetEntity && this.targetEntity.hp <= 0) this.targetEntity = null;

    if (this.team === TEAM.RED && !this.targetEntity && !this.targetPos) {
      this.aiCd -= dt;
      if (this.aiCd <= 0) {
        this.aiCd = rand(0.8, 1.7);
        const neutralVehicle = game.getNearestNeutralVehicle(this.x, this.y);
        if (neutralVehicle && Math.random() < 0.25 && this.type === 'infantry') {
          this.setMove(neutralVehicle.x, neutralVehicle.y);
        } else {
          const obj = game.getObjective(this.team);
          this.setMove(obj.x + rand(-16, 16), obj.y + rand(-16, 16));
        }
      }
    }

    if (!this.targetEntity) {
      const enemies = game.getEnemies(this.team);
      let best = null;
      let bestDist = this.range * this.range * 1.7;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const dd = d2(this, e);
        if (dd < bestDist) {
          bestDist = dd;
          best = e;
        }
      }
      if (best) this.targetEntity = best;
    }

    if (this.targetEntity) {
      const dx = this.targetEntity.x - this.x;
      const dy = this.targetEntity.y - this.y;
      this.heading = Math.atan2(dy, dx);
      const dist2 = d2(this, this.targetEntity);
      if (dist2 > this.range * this.range) this.moveTo(this.targetEntity.x, this.targetEntity.y, dt);
      else if (this.cool <= 0) {
        this.cool = this.cooldown;
        game.projectiles.push(new Projectile(this, this.targetEntity, Math.floor(rand(this.minDmg, this.maxDmg + 1))));
      }
      return;
    }

    if (this.targetPos) {
      const dx = this.targetPos.x - this.x;
      const dy = this.targetPos.y - this.y;
      this.heading = Math.atan2(dy, dx);
      const dist = Math.hypot(dx, dy);
      if (dist < 4) this.targetPos = null;
      else this.moveTo(this.targetPos.x, this.targetPos.y, dt);
    }

    if (this.type === 'infantry') {
      const v = game.getNearestNeutralVehicle(this.x, this.y, 20);
      if (v) {
        this.hp = 0;
        game.neutralVehicles = game.neutralVehicles.filter(n => n !== v);
        game.units.push(new Unit(this.team, v.x + rand(-6, 6), v.y + rand(-6, 6), 'tank'));
      }
    }
  }

  moveTo(tx, ty, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const len = Math.hypot(dx, dy) || 1;
    this.x = clamp(this.x + (dx / len) * this.speed * dt, this.r, W - this.r);
    this.y = clamp(this.y + (dy / len) * this.speed * dt, this.r, H - this.r);
  }

  draw() {
    ctx.fillStyle = '#00000058';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 9, this.type === 'tank' ? 16 : 10, this.type === 'tank' ? 6 : 4, 0, 0, Math.PI * 2);
    ctx.fill();

    let img, size;
    if (this.type === 'tank') {
      img = this.team === TEAM.BLUE ? imgTankBlue : imgTankRed;
      size = 56;
    } else {
      img = this.team === TEAM.BLUE ? imgSoldierBlue : imgSoldierRed;
      size = 42;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    const offset = this.type === 'tank' ? Math.PI / 4 : 0;
    ctx.rotate(this.heading + offset);

    if (img.complete) ctx.drawImage(img, -size / 2, -size / 2, size, size);
    else {
      ctx.fillStyle = this.team === TEAM.BLUE ? C.blue : C.red;
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.type === 'rocketeer') {
      ctx.fillStyle = '#f6d95e';
      ctx.fillRect(-3, -18, 6, 6);
    }

    ctx.restore();

    ctx.fillStyle = '#000a';
    ctx.fillRect(this.x - 14, this.y - 20, 28, 4);
    ctx.fillStyle = this.team === TEAM.BLUE ? C.blueSoft : C.redSoft;
    ctx.fillRect(this.x - 14, this.y - 20, 28 * (this.hp / this.maxHp), 4);

    if (this.selected) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }
}

class Projectile {
  constructor(from, target, dmg) {
    this.team = from.team;
    this.type = from.type;
    this.x = from.x;
    this.y = from.y;
    this.target = target;
    this.dmg = dmg;
    this.speed = from.type === 'tank' ? 360 : from.type === 'rocketeer' ? 320 : from.type === 'turret' ? 420 : 460;
    this.dead = false;
  }

  update(dt, game) {
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
      game.spawnImpact(this.target.x, this.target.y, this.team === TEAM.BLUE ? '#8ed4ff' : '#ffb0b0');
      return;
    }

    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
  }

  draw() {
    const col = this.team === TEAM.BLUE ? C.shellBlue : C.shellRed;
    const r = this.type === 'tank' ? 3.2 : this.type === 'rocketeer' ? 2.8 : this.type === 'turret' ? 2.5 : 2.2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }
}

class Game {
  constructor() {
    this.sectors = [];
    this.units = [];
    this.projectiles = [];
    this.neutralVehicles = [];
    this.turrets = [];
    this.selected = [];
    this.drag = { active: false, start: null, end: null };
    this.particles = [];
    this.craters = [];

    this.paused = false;
    this.gameOver = false;

    this.production = {
      blue: 8,
      red: 8,
      queueBlue: ['infantry', 'rocketeer', 'infantry', 'tank', 'infantry'],
      queueRed: ['infantry', 'rocketeer', 'infantry', 'tank', 'infantry'],
      idxBlue: 0,
      idxRed: 0,
    };

    this.setupMap();
    this.setupArmies();
    this.bindInput();

    uiHint.textContent = 'Z-style: сектора, турели, захват техники. ЛКМ — рамка, ПКМ — приказ, E — высадить пилота из выбранного танка.';
  }

  setupMap() {
    const cols = 4;
    const rows = 3;
    const marginX = 40;
    const marginY = 34;
    const gap = 8;
    const sw = (W - marginX * 2 - gap * (cols - 1)) / cols;
    const sh = (H - marginY * 2 - gap * (rows - 1)) / rows;

    const biomeRows = ['desert', 'snow', 'volcanic', 'swamp', 'city'];

    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = marginX + c * (sw + gap);
        const y = marginY + r * (sh + gap);
        const hasFactory = (r === 1 && (c === 1 || c === 2)) || (r === 0 && c === 1) || (r === 2 && c === 2);
        const hasGarage = (r === 1 && (c === 0 || c === 3));
        const biome = biomeRows[(c + r) % biomeRows.length];
        const s = new Sector(id++, x, y, sw, sh, hasFactory, hasGarage, biome);
        this.sectors.push(s);
      }
    }

    this.baseBlue = new Base(TEAM.BLUE, 84, H / 2);
    this.baseRed = new Base(TEAM.RED, W - 84, H / 2);

    this.sectors.forEach(s => {
      if (s.cx < W * 0.34) {
        s.owner = TEAM.BLUE;
        s.capture = 100;
      } else if (s.cx > W * 0.66) {
        s.owner = TEAM.RED;
        s.capture = -100;
      }
    });

    this.neutralVehicles.push(new NeutralVehicle(W * 0.5, H * 0.25));
    this.neutralVehicles.push(new NeutralVehicle(W * 0.5, H * 0.75));

    // Turrets on key sectors
    const turretSectorIds = [1, 2, 5, 6, 9, 10];
    for (const id of turretSectorIds) {
      const sec = this.sectors.find(s => s.id === id);
      if (sec) this.turrets.push(new Turret(sec));
    }
  }

  setupArmies() {
    for (let i = 0; i < 8; i++) {
      this.units.push(new Unit(TEAM.BLUE, 128 + rand(-24, 24), H / 2 + rand(-50, 50), i % 4 === 0 ? 'rocketeer' : 'infantry'));
      this.units.push(new Unit(TEAM.RED, W - 128 + rand(-24, 24), H / 2 + rand(-50, 50), i % 4 === 0 ? 'rocketeer' : 'infantry'));
    }
  }

  bindInput() {
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    canvas.addEventListener('mousedown', e => {
      const p = this.getMouse(e);
      if (e.button === 0) {
        this.drag.active = true;
        this.drag.start = p;
        this.drag.end = p;
      }
      if (e.button === 2) {
        const enemy = this.findEnemyEntityAt(p.x, p.y);
        if (enemy) this.issueAttack(enemy);
        else this.issueMove(p.x, p.y);
      }
    });

    canvas.addEventListener('mousemove', e => {
      if (this.drag.active) this.drag.end = this.getMouse(e);
    });

    canvas.addEventListener('mouseup', e => {
      if (e.button !== 0 || !this.drag.active) return;
      this.drag.active = false;

      const a = this.drag.start;
      const b = this.drag.end;
      const w = Math.abs(a.x - b.x);
      const h = Math.abs(a.y - b.y);
      this.clearSelection();

      if (w < 6 && h < 6) {
        const one = this.findOwnAt(a.x, a.y);
        if (one) {
          one.selected = true;
          this.selected = [one];
        }
      } else {
        const x1 = Math.min(a.x, b.x);
        const y1 = Math.min(a.y, b.y);
        const x2 = Math.max(a.x, b.x);
        const y2 = Math.max(a.y, b.y);
        for (const u of this.units) {
          if (u.team !== TEAM.BLUE || u.hp <= 0) continue;
          if (u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2) {
            u.selected = true;
            this.selected.push(u);
          }
        }
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key.toLowerCase() === 'e') this.ejectSelectedTanks();
    });

    pauseBtn.addEventListener('click', () => {
      this.paused = !this.paused;
      pauseBtn.textContent = this.paused ? 'Продолжить' : 'Пауза';
    });
  }

  ejectSelectedTanks() {
    const tanks = this.selected.filter(u => u.type === 'tank' && u.team === TEAM.BLUE && u.hp > 0);
    for (const t of tanks) {
      this.neutralVehicles.push(new NeutralVehicle(t.x + rand(-4, 4), t.y + rand(-4, 4), 'tank'));
      this.units.push(new Unit(TEAM.BLUE, t.x + rand(-12, 12), t.y + rand(-12, 12), 'infantry'));
      t.hp = 0;
    }
    this.units = this.units.filter(u => u.hp > 0);
    this.clearSelection();
  }

  spawnImpact(x, y, color) {
    for (let i = 0; i < 12; i++) this.particles.push(new Particle(x, y, color));
    this.craters.push({ x: x + rand(-2, 2), y: y + rand(-2, 2), r: rand(6, 11), life: 9 });
    if (this.craters.length > 50) this.craters.shift();
  }

  getMouse(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  clearSelection() {
    for (const u of this.units) u.selected = false;
    this.selected = [];
  }

  findOwnAt(x, y) {
    let best = null;
    let bestD = 1e9;
    for (const u of this.units) {
      if (u.team !== TEAM.BLUE || u.hp <= 0) continue;
      const dd = d2({ x, y }, u);
      if (dd < (u.r + 8) * (u.r + 8) && dd < bestD) {
        bestD = dd;
        best = u;
      }
    }
    return best;
  }

  findEnemyEntityAt(x, y) {
    let best = null;
    let bestD = 1e9;
    for (const u of this.units) {
      if (u.team === TEAM.BLUE || u.hp <= 0) continue;
      const dd = d2({ x, y }, u);
      if (dd < (u.r + 9) * (u.r + 9) && dd < bestD) {
        best = u;
        bestD = dd;
      }
    }
    if (best) return best;

    const b = this.baseRed;
    if (x >= b.x - b.w / 2 && x <= b.x + b.w / 2 && y >= b.y - b.h / 2 && y <= b.y + b.h / 2 && b.hp > 0) return b;
    return null;
  }

  issueMove(x, y) {
    if (!this.selected.length) return;
    const cols = Math.ceil(Math.sqrt(this.selected.length));
    const spacing = 22;
    this.selected.forEach((u, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      u.setMove(x + (col - (cols - 1) / 2) * spacing, y + (row - (cols - 1) / 2) * spacing);
    });
  }

  issueAttack(target) {
    for (const u of this.selected) u.setAttack(target);
  }

  getEnemies(team) {
    const out = [];
    for (const u of this.units) if (u.team !== team && u.hp > 0) out.push(u);
    const enemyBase = team === TEAM.BLUE ? this.baseRed : this.baseBlue;
    if (enemyBase.hp > 0) out.push(enemyBase);
    return out;
  }

  getNearestNeutralVehicle(x, y, maxDist = 5000) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const v of this.neutralVehicles) {
      const dd = d2({ x, y }, v);
      if (dd < bestD) {
        bestD = dd;
        best = v;
      }
    }
    return best;
  }

  getObjective(team) {
    const neutral = this.sectors.find(s => s.owner === TEAM.NEUTRAL);
    if (neutral) return { x: neutral.cx, y: neutral.cy };
    const enemySector = this.sectors.find(s => s.owner !== team);
    if (enemySector) return { x: enemySector.cx, y: enemySector.cy };
    return team === TEAM.BLUE ? { x: this.baseRed.x, y: this.baseRed.y } : { x: this.baseBlue.x, y: this.baseBlue.y };
  }

  updateProduction(dt) {
    const blueSectors = this.sectors.filter(s => s.owner === TEAM.BLUE).length;
    const redSectors = this.sectors.filter(s => s.owner === TEAM.RED).length;
    const blueFactories = this.sectors.filter(s => s.owner === TEAM.BLUE && s.hasFactory).length;
    const redFactories = this.sectors.filter(s => s.owner === TEAM.RED && s.hasFactory).length;

    this.production.blue -= dt * (1 + blueSectors * 0.12 + blueFactories * 0.38);
    this.production.red -= dt * (1 + redSectors * 0.12 + redFactories * 0.38);

    if (this.production.blue <= 0) {
      this.production.blue = 8;
      const type = this.production.queueBlue[this.production.idxBlue++ % this.production.queueBlue.length];
      if (this.units.filter(u => u.team === TEAM.BLUE && u.hp > 0).length < 120) {
        this.units.push(new Unit(TEAM.BLUE, this.baseBlue.x + rand(-18, 18), this.baseBlue.y + rand(-18, 18), type));
      }
    }

    if (this.production.red <= 0) {
      this.production.red = 8;
      const type = this.production.queueRed[this.production.idxRed++ % this.production.queueRed.length];
      if (this.units.filter(u => u.team === TEAM.RED && u.hp > 0).length < 120) {
        this.units.push(new Unit(TEAM.RED, this.baseRed.x + rand(-18, 18), this.baseRed.y + rand(-18, 18), type));
      }
    }
  }

  update(dt) {
    if (this.paused || this.gameOver) return;

    for (const s of this.sectors) s.update(dt, this.units);
    this.updateProduction(dt);

    this.baseBlue.update(dt, this);
    this.baseRed.update(dt, this);

    for (const t of this.turrets) t.update(dt, this);

    for (const u of this.units) u.update(dt, this);
    this.units = this.units.filter(u => u.hp > 0);

    for (const p of this.projectiles) p.update(dt, this);
    this.projectiles = this.projectiles.filter(p => !p.dead);

    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => !p.dead);

    for (const c of this.craters) c.life -= dt;
    this.craters = this.craters.filter(c => c.life > 0);

    const blueUnits = this.units.filter(u => u.team === TEAM.BLUE).length;
    const redUnits = this.units.filter(u => u.team === TEAM.RED).length;
    const blueSectors = this.sectors.filter(s => s.owner === TEAM.BLUE).length;
    const redSectors = this.sectors.filter(s => s.owner === TEAM.RED).length;

    uiBlue.textContent = `Сектора: ${blueSectors} | Юниты: ${blueUnits} | Форт: ${Math.max(0, Math.floor(this.baseBlue.hp))}`;
    uiRed.textContent = `Сектора: ${redSectors} | Юниты: ${redUnits} | Форт: ${Math.max(0, Math.floor(this.baseRed.hp))}`;

    if (this.baseBlue.hp <= 0 || this.baseRed.hp <= 0) {
      this.gameOver = true;
      uiHint.textContent = this.baseRed.hp <= 0 ? 'Победа! Красный форт уничтожен.' : 'Поражение. Синий форт пал.';
    }
  }

  drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#141a23');
    grad.addColorStop(1, '#0f141c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.lineWidth = 12;
    ctx.strokeStyle = C.road;
    ctx.beginPath();
    ctx.moveTo(70, H * 0.33); ctx.lineTo(W - 70, H * 0.33);
    ctx.moveTo(70, H * 0.66); ctx.lineTo(W - 70, H * 0.66);
    ctx.moveTo(W * 0.5, 40); ctx.lineTo(W * 0.5, H - 40);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = C.roadLine;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(70, H * 0.33); ctx.lineTo(W - 70, H * 0.33);
    ctx.moveTo(70, H * 0.66); ctx.lineTo(W - 70, H * 0.66);
    ctx.moveTo(W * 0.5, 40); ctx.lineTo(W * 0.5, H - 40);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#243140';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    for (const c of this.craters) {
      ctx.globalAlpha = clamp(c.life / 9, 0, 0.35);
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  worldToMini(x, y) {
    const m = { x: W - 228, y: H - 150, w: 210, h: 132 };
    return { x: m.x + (x / W) * m.w, y: m.y + (y / H) * m.h };
  }

  drawMinimap() {
    const m = { x: W - 228, y: H - 150, w: 210, h: 132 };
    ctx.fillStyle = '#0b1017e8';
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.strokeStyle = '#33506a';
    ctx.strokeRect(m.x, m.y, m.w, m.h);

    for (const s of this.sectors) {
      const p1 = this.worldToMini(s.x, s.y);
      const p2 = this.worldToMini(s.x + s.w, s.y + s.h);
      const col = s.owner === TEAM.BLUE ? '#2f89cf' : s.owner === TEAM.RED ? '#c74a4a' : '#6a7380';
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      ctx.globalAlpha = 1;
    }

    for (const u of this.units) {
      const p = this.worldToMini(u.x, u.y);
      ctx.fillStyle = u.team === TEAM.BLUE ? C.blue : C.red;
      ctx.fillRect(p.x, p.y, 2, 2);
    }
  }

  draw() {
    this.drawBackground();

    for (const s of this.sectors) s.draw();
    this.baseBlue.draw();
    this.baseRed.draw();

    for (const t of this.turrets) t.draw();
    for (const v of this.neutralVehicles) v.draw();
    for (const u of this.units) u.draw();
    for (const p of this.projectiles) p.draw();
    for (const p of this.particles) p.draw();

    if (this.drag.active) {
      const a = this.drag.start;
      const b = this.drag.end;
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(a.x - b.x);
      const h = Math.abs(a.y - b.y);
      ctx.fillStyle = '#9bd0ff20';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#9bd0ff';
      ctx.strokeRect(x, y, w, h);
    }

    this.drawMinimap();

    if (this.paused) {
      ctx.fillStyle = '#000a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 42px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText('ПАУЗА', W / 2, H / 2);
      ctx.textAlign = 'start';
    }
  }
}

const game = new Game();
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
