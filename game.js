const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const uiBlue = document.getElementById('blueScore');
const uiRed = document.getElementById('redScore');
const uiHint = document.getElementById('hint');
const pauseBtn = document.getElementById('pauseBtn');

const TEAM = { BLUE:'blue', RED:'red', NEUTRAL:'neutral' };
const C = {
  bg:'#141b23', grid:'#1f2b36', blue:'#4aa8ff', red:'#ff6565', neutral:'#b7bdc7',
  blue2:'#88c9ff', red2:'#ffaaaa', bulletBlue:'#8dd3ff', bulletRed:'#ffc3c3'
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>Math.random()*(b-a)+a;
const d2=(a,b)=>{const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy;};

class Unit {
  constructor(team,x,y){
    this.team=team; this.x=x; this.y=y; this.r=8;
    this.hp=100; this.maxHp=100; this.speed=90;
    this.targetPos=null; this.targetUnit=null; this.attackRange=110; this.cool=0;
    this.selected=false; this.aiCd=rand(0.6,1.8);
  }
  setMove(x,y){ this.targetPos={x:clamp(x,10,W-10),y:clamp(y,10,H-10)}; this.targetUnit=null; }
  setAttack(u){ this.targetUnit=u; this.targetPos=null; }
  update(dt,g){
    if(this.hp<=0) return;
    this.cool=Math.max(0,this.cool-dt);
    if(this.targetUnit&&this.targetUnit.hp<=0) this.targetUnit=null;

    if(!this.targetUnit && !this.targetPos){
      this.aiCd-=dt;
      if(this.aiCd<=0){
        this.aiCd=rand(1,2.2);
        const obj=g.getObjective(this.team);
        if(obj) this.setMove(obj.x+rand(-30,30),obj.y+rand(-30,30));
      }
    }

    if(!this.targetUnit){
      let best=null,bestD=170*170;
      for(const u of g.units){
        if(u.team===this.team||u.hp<=0) continue;
        const dd=d2(this,u); if(dd<bestD){bestD=dd;best=u;}
      }
      if(best) this.targetUnit=best;
    }

    if(this.targetUnit){
      const dd=d2(this,this.targetUnit);
      if(dd>this.attackRange*this.attackRange){
        this.moveTo(this.targetUnit.x,this.targetUnit.y,dt);
      } else if(this.cool<=0){
        this.cool=0.45;
        g.bullets.push(new Bullet(this,this.targetUnit,10+Math.floor(Math.random()*4)));
      }
      return;
    }

    if(this.targetPos){
      const dx=this.targetPos.x-this.x, dy=this.targetPos.y-this.y;
      const dist=Math.hypot(dx,dy);
      if(dist<4) this.targetPos=null;
      else this.moveTo(this.targetPos.x,this.targetPos.y,dt);
    }
  }
  moveTo(tx,ty,dt){
    const dx=tx-this.x,dy=ty-this.y,d=Math.hypot(dx,dy)||1;
    this.x=clamp(this.x+dx/d*this.speed*dt,this.r,W-this.r);
    this.y=clamp(this.y+dy/d*this.speed*dt,this.r,H-this.r);
  }
  draw(){
    const c=this.team===TEAM.BLUE?C.blue:C.red, c2=this.team===TEAM.BLUE?C.blue2:C.red2;
    ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();ctx.strokeStyle='#0b1117';ctx.stroke();
    ctx.fillStyle='#0008';ctx.fillRect(this.x-12,this.y-16,24,4);
    ctx.fillStyle=c2;ctx.fillRect(this.x-12,this.y-16,24*this.hp/this.maxHp,4);
    if(this.selected){ctx.beginPath();ctx.arc(this.x,this.y,this.r+4,0,Math.PI*2);ctx.strokeStyle='#fff';ctx.stroke();}
  }
}

class Bullet{
  constructor(from,target,dmg){this.team=from.team;this.x=from.x;this.y=from.y;this.target=target;this.dmg=dmg;this.speed=430;this.dead=false;}
  update(dt){
    if(!this.target||this.target.hp<=0){this.dead=true;return;}
    const dx=this.target.x-this.x,dy=this.target.y-this.y,d=Math.hypot(dx,dy)||1,step=this.speed*dt;
    if(d<=step){this.target.hp-=this.dmg;this.dead=true;return;}
    this.x+=dx/d*step; this.y+=dy/d*step;
  }
  draw(){ctx.beginPath();ctx.arc(this.x,this.y,2.2,0,Math.PI*2);ctx.fillStyle=this.team===TEAM.BLUE?C.bulletBlue:C.bulletRed;ctx.fill();}
}

class Flag{
  constructor(x,y){this.x=x;this.y=y;this.owner=TEAM.NEUTRAL;this.capture=0;this.radius=50;}
  update(dt,units){
    let b=0,r=0,rr=this.radius*this.radius;
    for(const u of units){if(u.hp>0&&d2(u,this)<=rr){if(u.team===TEAM.BLUE)b++;else r++;}}
    if(b!==r){this.capture=clamp(this.capture+(b-r)*30*dt,-100,100);}
    if(this.capture>=100)this.owner=TEAM.BLUE; else if(this.capture<=-100)this.owner=TEAM.RED;
    else if(Math.abs(this.capture)<4&&b===0&&r===0)this.owner=TEAM.NEUTRAL;
  }
  draw(){
    ctx.beginPath();ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);ctx.strokeStyle='#ffffff22';ctx.stroke();
    ctx.strokeStyle='#d5dbe3';ctx.beginPath();ctx.moveTo(this.x,this.y+16);ctx.lineTo(this.x,this.y-16);ctx.stroke();
    const col=this.owner===TEAM.BLUE?C.blue:this.owner===TEAM.RED?C.red:C.neutral;
    ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(this.x,this.y-16);ctx.lineTo(this.x+22,this.y-8);ctx.lineTo(this.x,this.y);ctx.closePath();ctx.fill();
    ctx.fillStyle='#0008';ctx.fillRect(this.x-24,this.y+22,48,5);
    if(this.capture>=0){ctx.fillStyle=C.blue;ctx.fillRect(this.x,this.y+22,this.capture/100*24,5);} 
    else {ctx.fillStyle=C.red;ctx.fillRect(this.x+this.capture/100*24,this.y+22,Math.abs(this.capture/100*24),5);}  
  }
}

class Factory{
  constructor(team,x,y){this.team=team;this.x=x;this.y=y;this.cd=1;}
  update(dt,g){
    this.cd-=dt;
    if(this.cd<=0){
      this.cd=4.2;
      const cnt=g.units.filter(u=>u.team===this.team&&u.hp>0).length;
      if(cnt<50) g.units.push(new Unit(this.team,this.x+rand(-14,14),this.y+rand(-14,14)));
    }
  }
  draw(){
    ctx.fillStyle='#35414f';ctx.fillRect(this.x-22,this.y-22,44,44);
    ctx.strokeStyle=this.team===TEAM.BLUE?C.blue:C.red;ctx.lineWidth=2;ctx.strokeRect(this.x-22,this.y-22,44,44);
  }
}

class Game{
  constructor(){
    this.units=[];
    this.flags=[new Flag(330,190),new Flag(600,350),new Flag(870,510)];
    this.factories=[new Factory(TEAM.BLUE,95,350),new Factory(TEAM.RED,1105,350)];
    this.bullets=[];
    this.blueTickets=200;this.redTickets=200;this.gameOver=false;
    this.selected=[];
    this.drag={active:false,start:null,end:null};
    this.paused=false;
    this.minimap={x:W-210,y:H-140,w:190,h:120};

    for(let i=0;i<8;i++){this.units.push(new Unit(TEAM.BLUE,120+rand(-28,24),350+rand(-40,40)));this.units.push(new Unit(TEAM.RED,1080+rand(-24,28),350+rand(-40,40)));}
    this.bindInput();
  }

  bindInput(){
    canvas.addEventListener('contextmenu',e=>e.preventDefault());

    canvas.addEventListener('mousedown',e=>{
      const p=this.getMouse(e);

      if(e.button===0){
        if(this.inRect(p,this.minimap)){
          // move selected to minimap click
          const world=this.minimapToWorld(p.x,p.y);
          this.issueMove(world.x,world.y);
          return;
        }
        this.drag.active=true; this.drag.start=p; this.drag.end=p;
      }

      if(e.button===2){
        const enemy=this.findEnemyAt(p.x,p.y);
        if(enemy) this.issueAttack(enemy);
        else this.issueMove(p.x,p.y);
      }
    });

    canvas.addEventListener('mousemove',e=>{
      if(!this.drag.active) return;
      this.drag.end=this.getMouse(e);
    });

    canvas.addEventListener('mouseup',e=>{
      if(e.button!==0||!this.drag.active) return;
      const a=this.drag.start,b=this.drag.end;
      this.drag.active=false;

      const w=Math.abs(a.x-b.x), h=Math.abs(a.y-b.y);
      this.clearSelection();

      if(w<6&&h<6){
        const one=this.findOwnAt(a.x,a.y);
        if(one){one.selected=true;this.selected=[one];}
      } else {
        const x1=Math.min(a.x,b.x),y1=Math.min(a.y,b.y),x2=Math.max(a.x,b.x),y2=Math.max(a.y,b.y);
        for(const u of this.units){
          if(u.team!==TEAM.BLUE||u.hp<=0) continue;
          if(u.x>=x1&&u.x<=x2&&u.y>=y1&&u.y<=y2){u.selected=true;this.selected.push(u);}
        }
      }
    });

    pauseBtn.addEventListener('click',()=>{
      this.paused=!this.paused;
      pauseBtn.textContent=this.paused?'Продолжить':'Пауза';
      uiHint.textContent=this.paused?'Пауза включена':'ЛКМ: выделение (можно рамкой), ПКМ: идти/атаковать';
    });
  }

  getMouse(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  inRect(p,r){return p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;}
  worldToMinimap(x,y){const m=this.minimap; return {x:m.x+x/W*m.w, y:m.y+y/H*m.h};}
  minimapToWorld(x,y){const m=this.minimap; return {x:clamp((x-m.x)/m.w*W,0,W), y:clamp((y-m.y)/m.h*H,0,H)};}

  findOwnAt(x,y){
    let best=null,bd=1e9;
    for(const u of this.units){if(u.team!==TEAM.BLUE||u.hp<=0)continue; const dd=d2({x,y},u); if(dd<(u.r+7)*(u.r+7)&&dd<bd){best=u;bd=dd;}}
    return best;
  }
  findEnemyAt(x,y){
    let best=null,bd=1e9;
    for(const u of this.units){if(u.team===TEAM.BLUE||u.hp<=0)continue; const dd=d2({x,y},u); if(dd<(u.r+8)*(u.r+8)&&dd<bd){best=u;bd=dd;}}
    return best;
  }

  clearSelection(){for(const u of this.units)u.selected=false; this.selected=[];}

  issueMove(x,y){
    if(!this.selected.length) return;
    const cols=Math.ceil(Math.sqrt(this.selected.length));
    const spacing=20;
    this.selected.forEach((u,i)=>{
      const row=Math.floor(i/cols), col=i%cols;
      const tx=x+(col-(cols-1)/2)*spacing;
      const ty=y+(row-(cols-1)/2)*spacing;
      u.setMove(tx,ty);
    });
  }
  issueAttack(enemy){ if(!this.selected.length)return; this.selected.forEach(u=>u.setAttack(enemy)); }

  getObjective(team){
    const n=this.flags.find(f=>f.owner===TEAM.NEUTRAL); if(n) return n;
    const e=this.flags.find(f=>f.owner!==team); if(e) return e;
    return {x:W/2,y:H/2};
  }

  update(dt){
    if(this.paused||this.gameOver) return;
    this.factories.forEach(f=>f.update(dt,this));
    this.flags.forEach(f=>f.update(dt,this.units));

    const b=this.flags.filter(f=>f.owner===TEAM.BLUE).length;
    const r=this.flags.filter(f=>f.owner===TEAM.RED).length;
    if(b>r) this.redTickets=Math.max(0,this.redTickets-(b-r)*dt*2.4);
    if(r>b) this.blueTickets=Math.max(0,this.blueTickets-(r-b)*dt*2.4);

    this.units.forEach(u=>u.update(dt,this));
    this.units=this.units.filter(u=>u.hp>0);
    this.bullets.forEach(bu=>bu.update(dt));
    this.bullets=this.bullets.filter(bu=>!bu.dead);

    uiBlue.textContent=`${Math.ceil(this.blueTickets)} (${b} флага)`;
    uiRed.textContent=`${Math.ceil(this.redTickets)} (${r} флага)`;

    if(this.blueTickets<=0||this.redTickets<=0){
      this.gameOver=true;
      uiHint.textContent=(this.blueTickets>this.redTickets?'Синие победили! ':'Красные победили! ')+'Нажми F5 для рестарта';
    }
  }

  drawGrid(){
    ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle=C.grid; ctx.lineWidth=1;
    for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  }

  drawMinimap(){
    const m=this.minimap;
    ctx.fillStyle='#0c1218dd'; ctx.fillRect(m.x,m.y,m.w,m.h);
    ctx.strokeStyle='#36506a'; ctx.strokeRect(m.x,m.y,m.w,m.h);

    for(const f of this.flags){
      const p=this.worldToMinimap(f.x,f.y);
      ctx.fillStyle=f.owner===TEAM.BLUE?C.blue:f.owner===TEAM.RED?C.red:C.neutral;
      ctx.fillRect(p.x-2,p.y-2,4,4);
    }
    for(const u of this.units){
      const p=this.worldToMinimap(u.x,u.y);
      ctx.fillStyle=u.team===TEAM.BLUE?C.blue:C.red;
      ctx.fillRect(p.x,p.y,2,2);
    }
  }

  draw(){
    this.drawGrid();
    this.flags.forEach(f=>f.draw());
    this.factories.forEach(f=>f.draw());
    this.units.forEach(u=>u.draw());
    this.bullets.forEach(b=>b.draw());

    if(this.drag.active){
      const a=this.drag.start,b=this.drag.end;
      const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
      ctx.fillStyle='#9fd0ff1a';ctx.fillRect(x,y,w,h);
      ctx.strokeStyle='#9fd0ff';ctx.strokeRect(x,y,w,h);
    }

    this.drawMinimap();

    if(this.paused){
      ctx.fillStyle='#0009';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#fff';ctx.font='bold 42px Segoe UI';ctx.textAlign='center';ctx.fillText('ПАУЗА',W/2,H/2);
      ctx.textAlign='start';
    }
  }
}

const game=new Game();
let last=performance.now();
function loop(now){
  const dt=Math.min(0.033,(now-last)/1000); last=now;
  game.update(dt); game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
