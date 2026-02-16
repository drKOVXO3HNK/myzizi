const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const blueScoreEl = document.getElementById('blueScore');
const redScoreEl = document.getElementById('redScore');

const TEAM = { BLUE:'blue', RED:'red', NEUTRAL:'neutral' };
const colors = { blue:'#44a2ff', red:'#ff5b5b', neutral:'#aaa', bg:'#17212b', grid:'#223243', flagPole:'#ddd', bullet:'#ffd166' };

const rand=(a,b)=>Math.random()*(b-a)+a;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

class Unit {
  constructor(team,x,y){
    this.team=team; this.x=x; this.y=y;
    this.hp=100; this.r=9;
    this.speed=1.3; this.targetPos=null; this.targetUnit=null;
    this.reload=0;
    this.selected=false;
  }
  update(units){
    if(this.reload>0) this.reload--;
    if(this.targetUnit && this.targetUnit.hp<=0) this.targetUnit=null;

    if(this.targetUnit){
      const d=dist(this,this.targetUnit);
      if(d>110){ this.moveToward(this.targetUnit.x,this.targetUnit.y); }
      else if(this.reload===0){
        this.reload=28;
        this.targetUnit.hp -= 10;
        bullets.push({x:this.x,y:this.y,tx:this.targetUnit.x,ty:this.targetUnit.y,t:0});
      }
    } else if(this.targetPos){
      const d=Math.hypot(this.targetPos.x-this.x,this.targetPos.y-this.y);
      if(d<4) this.targetPos=null;
      else this.moveToward(this.targetPos.x,this.targetPos.y);
    }
  }
  moveToward(tx,ty){
    const dx=tx-this.x, dy=ty-this.y, d=Math.hypot(dx,dy)||1;
    this.x += dx/d*this.speed;
    this.y += dy/d*this.speed;
    this.x = Math.max(8,Math.min(W-8,this.x));
    this.y = Math.max(8,Math.min(H-8,this.y));
  }
  draw(){
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
    ctx.fillStyle = this.team===TEAM.BLUE?colors.blue:colors.red;
    ctx.fill();
    ctx.strokeStyle='#111'; ctx.stroke();

    ctx.fillStyle='#0008'; ctx.fillRect(this.x-12,this.y-16,24,4);
    ctx.fillStyle=this.team===TEAM.BLUE?'#66c2ff':'#ff8b8b';
    ctx.fillRect(this.x-12,this.y-16,24*(this.hp/100),4);

    if(this.selected){
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r+4,0,Math.PI*2);
      ctx.strokeStyle='#fff'; ctx.stroke();
    }
  }
}

class Factory {
  constructor(team,x,y){ this.team=team; this.x=x; this.y=y; this.spawnCd=0; }
  update(){
    this.spawnCd--;
    if(this.spawnCd<=0){
      this.spawnCd = 240;
      units.push(new Unit(this.team,this.x+rand(-20,20),this.y+rand(-20,20)));
    }
  }
  draw(){
    ctx.fillStyle = this.team===TEAM.BLUE? '#2d5e91':'#8b2f2f';
    ctx.fillRect(this.x-22,this.y-22,44,44);
    ctx.strokeStyle='#ddd'; ctx.strokeRect(this.x-22,this.y-22,44,44);
  }
}

class Flag {
  constructor(x,y){ this.x=x; this.y=y; this.owner=TEAM.NEUTRAL; this.capture=0; }
  update(){
    let b=0,r=0;
    for(const u of units){ if(u.hp<=0) continue; if(dist(u,this)<48){ if(u.team===TEAM.BLUE)b++; else r++; } }
    if(b>r){ this.capture = Math.min(100,this.capture+0.8*(b-r)); }
    else if(r>b){ this.capture = Math.max(-100,this.capture-0.8*(r-b)); }

    if(this.capture>=100) this.owner=TEAM.BLUE;
    if(this.capture<=-100) this.owner=TEAM.RED;
  }
  draw(){
    ctx.strokeStyle=colors.flagPole; ctx.beginPath(); ctx.moveTo(this.x,this.y+16); ctx.lineTo(this.x,this.y-16); ctx.stroke();
    const c=this.owner===TEAM.BLUE?colors.blue:this.owner===TEAM.RED?colors.red:colors.neutral;
    ctx.fillStyle=c;
    ctx.beginPath(); ctx.moveTo(this.x,this.y-16); ctx.lineTo(this.x+20,this.y-8); ctx.lineTo(this.x,this.y); ctx.closePath(); ctx.fill();

    ctx.fillStyle='#fff';
    ctx.fillRect(this.x-22,this.y+20,44,5);
    ctx.fillStyle=this.capture>=0?colors.blue:colors.red;
    ctx.fillRect(this.x,this.y+20,(this.capture/100)*22,5);
    ctx.fillRect(this.x+(this.capture<0?this.capture/100*22:0),this.y+20,Math.abs(this.capture/100*22),5);
  }
}

const units=[];
const factories=[ new Factory(TEAM.BLUE,100,350), new Factory(TEAM.RED,1100,350) ];
const flags=[ new Flag(350,220), new Flag(600,350), new Flag(850,500) ];
const bullets=[];
for(let i=0;i<4;i++){ units.push(new Unit(TEAM.BLUE,120+rand(-10,20),320+rand(-35,35))); units.push(new Unit(TEAM.RED,1080+rand(-20,10),320+rand(-35,35))); }

let selected=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mousedown',e=>{
  const rect=canvas.getBoundingClientRect();
  const x=e.clientX-rect.left, y=e.clientY-rect.top;
  if(e.button===0){
    selected=null;
    for(const u of units) u.selected=false;
    for(const u of units){ if(u.team===TEAM.BLUE && u.hp>0 && dist({x,y},u)<u.r+4){ selected=u; u.selected=true; break; } }
  }
  if(e.button===2 && selected){
    let enemy=null;
    for(const u of units){ if(u.team!==TEAM.BLUE && u.hp>0 && dist({x,y},u)<u.r+5){ enemy=u; break; } }
    if(enemy){ selected.targetUnit=enemy; selected.targetPos=null; }
    else { selected.targetUnit=null; selected.targetPos={x,y}; }
  }
});

function update(){
  for(const f of factories) f.update();
  for(const fl of flags) fl.update();
  for(const u of units) if(u.hp>0) u.update(units);
  for(let i=units.length-1;i>=0;i--) if(units[i].hp<=0) units.splice(i,1);

  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i]; b.t+=0.18; if(b.t>=1){ bullets.splice(i,1); continue; }
  }

  const blueFlags=flags.filter(f=>f.owner===TEAM.BLUE).length;
  const redFlags=flags.filter(f=>f.owner===TEAM.RED).length;
  blueScoreEl.textContent=blueFlags;
  redScoreEl.textContent=redFlags;
}

function drawGrid(){
  ctx.fillStyle=colors.bg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=colors.grid; ctx.lineWidth=1;
  for(let x=0;x<W;x+=40){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y=0;y<H;y+=40){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
}

function draw(){
  drawGrid();
  for(const f of factories) f.draw();
  for(const fl of flags) fl.draw();
  for(const u of units) u.draw();

  ctx.strokeStyle=colors.bullet; ctx.lineWidth=2;
  for(const b of bullets){
    const x=b.x+(b.tx-b.x)*b.t, y=b.y+(b.ty-b.y)*b.t;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-6,y-2); ctx.stroke();
  }
}

(function loop(){ update(); draw(); requestAnimationFrame(loop); })();
