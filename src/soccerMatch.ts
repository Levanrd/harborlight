/** A small autonomous 3-a-side match. All distances are rendering units and all
 * decisions use a fixed clock, independent of render rate. No city/save state. */
export type SoccerAction='support'|'press'|'mark'|'guard'|'dribble'|'receive'|'pass'|'shoot'|'celebrate';
export type SoccerPlayer={id:number;team:number;keeper:boolean;x:number;z:number;vx:number;vz:number;heading:number;walked:number;action:SoccerAction;actionAge:number;receive:number;kick:number;look:number;touch:number};
export type SoccerBall={x:number;y:number;z:number;vx:number;vy:number;vz:number;owner:number|null;roll:number};
type Strike={player:number;receiver:number|null;x:number;z:number;age:number;released:boolean};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const direction=(team:number)=>team===0?1:-1;
const turn=(a:number,b:number,amount:number)=>a+clamp(Math.atan2(Math.sin(b-a),Math.cos(b-a)),-amount,amount);
export const SOCCER={goalX:10.7,goalHalfWidth:1.46,ballRadius:.073,step:1/60};

export class SoccerMatch{
  players:SoccerPlayer[]=[];
  ball:SoccerBall={x:0,y:.073,z:0,vx:0,vy:0,vz:0,owner:0,roll:0};
  score=[0,0];time=0;event='Red kick-off';eventTime=0;
  stats={touches:0,passes:0,receptions:0,interceptions:0,tackles:0,shots:0,saves:0,goals:0};
  private lastTime:number|undefined;private remainder=0;private possessionAge=0;private teamPasses=0;
  private strike:Strike|undefined;private lastKicker=-1;private releaseTime=-10;
  private passTarget:number|null=null;
  private restartAge=-1;private restartTeam=0;private restartFrom={x:0,z:0};
  constructor(){this.initialize();}
  private initialize(){
    this.players=Array.from({length:6},(_,id)=>{const team=id<3?0:1,slot=id%3,d=direction(team);return {id,team,keeper:slot===2,x:slot===2?-d*9.2:-d*(slot===0?1.3:3.8),z:slot===1?d*2.6:0,vx:0,vz:0,heading:d*Math.PI/2,walked:0,action:'support',actionAge:0,receive:0,kick:0,look:0,touch:0};});
    this.ball={x:-1,y:SOCCER.ballRadius,z:.055,vx:0,vy:0,vz:0,owner:0,roll:0};
  }
  /** Repeated timestamps freeze exactly. A backward seek starts a fresh match;
   * large clock jumps rejoin live play without simulating a closed browser. */
  update(seconds:number){
    if(!Number.isFinite(seconds))return this;
    if(this.lastTime===undefined){this.lastTime=seconds;return this;}
    if(seconds<this.lastTime){const fresh=new SoccerMatch();Object.assign(this,fresh);this.lastTime=seconds;return this;}
    this.remainder+=Math.min(5,seconds-this.lastTime);this.lastTime=seconds;
    while(this.remainder+1e-9>=SOCCER.step){this.step(SOCCER.step);this.remainder-=SOCCER.step;}
    return this;
  }
  private announce(text:string){this.event=text;this.eventTime=this.time;}
  private action(p:SoccerPlayer,action:SoccerAction){if(p.action!==action){p.action=action;p.actionAge=0;}}
  private capture(p:SoccerPlayer){
    const previous=this.ball.owner,oldTeam=previous===null?this.players[this.lastKicker]?.team:this.players[previous].team;
    if(previous===null){
      if(p.keeper&&oldTeam!==p.team){this.stats.saves++;this.announce((p.team?'Blue':'Red')+' keeper saves');}
      else if(oldTeam===p.team){this.stats.receptions++;this.announce((p.team?'Blue':'Red')+' receives');}
      else{this.stats.interceptions++;this.announce((p.team?'Blue':'Red')+' intercepts');}
    }else if(previous!==p.id){this.stats.tackles++;this.announce((p.team?'Blue':'Red')+' wins possession');}
    if(oldTeam!==p.team)this.teamPasses=0;
    this.ball.owner=p.id;this.ball.vx=this.ball.vy=this.ball.vz=0;this.possessionAge=0;p.receive=1;
    this.passTarget=null;
  }
  private windup(p:SoccerPlayer,receiver:SoccerPlayer|null){
    const d=direction(p.team),goal={x:d*SOCCER.goalX,z:Math.sin(this.time*1.3)*.85};
    const target=receiver?{x:receiver.x+receiver.vx*.45,z:receiver.z+receiver.vz*.45}:goal;
    this.strike={player:p.id,receiver:receiver?.id??null,x:target.x,z:target.z,age:0,released:false};
    this.action(p,receiver?'pass':'shoot');
  }
  private step(dt:number){
    this.time+=dt;
    const ball=this.ball,owner=ball.owner===null?undefined:this.players[ball.owner],strike=this.strike;
    this.possessionAge+=dt;
    if(strike){
      strike.age+=dt;const kicker=this.players[strike.player];kicker.kick=clamp(strike.age/.72,.001,1);
      if(strike.age>=.30&&!strike.released){
        strike.released=true;const dx=strike.x-ball.x,dz=strike.z-ball.z,len=Math.max(.01,Math.hypot(dx,dz));
        const speed=strike.receiver===null?8.7:clamp(len*1.55,4.5,7.8);
        ball.owner=null;ball.vx=dx/len*speed;ball.vz=dz/len*speed;ball.vy=strike.receiver===null?1.35:.35;
        this.lastKicker=kicker.id;this.releaseTime=this.time;
        this.passTarget=strike.receiver;
        if(strike.receiver===null){this.stats.shots++;this.announce((kicker.team?'Blue':'Red')+' shoots');}
        else{this.stats.passes++;this.teamPasses++;this.announce((kicker.team?'Blue':'Red')+' passes');}
      }
      if(strike.age>=.72){kicker.kick=0;this.strike=undefined;}
    }
    const pressing=[0,1].map(team=>this.players.filter(p=>p.team===team&&!p.keeper).sort((a,b)=>distance(a,ball)-distance(b,ball))[0].id);
    for(const p of this.players){
      p.actionAge+=dt;p.receive=Math.max(0,p.receive-dt*2.5);const d=direction(p.team);
      let tx=p.x,tz=p.z,speed=1.85;
      const kicking=this.strike?.player===p.id;
      if(this.restartAge>=0){
        tx=p.keeper?-d*9.2:-d*(p.id%3===0?1.3:3.8);tz=p.id%3===1?d*2.6:0;speed=2.2;
        this.action(p,p.team!==this.restartTeam&&this.restartAge<1?'celebrate':'support');
      }else if(kicking){
        speed=0;this.action(p,this.strike!.receiver===null?'shoot':'pass');
      }else if(owner?.id===p.id&&ball.owner!==null){
        this.action(p,'dribble');
        const defender=this.players.filter(q=>q.team!==p.team&&!q.keeper).sort((a,b)=>distance(p,a)-distance(p,b))[0];
        tx=d*9.6;tz=clamp(p.z+(defender.z>p.z?-.8:.8),-3.4,3.4);speed=p.keeper?.8:1.45;
        const mate=this.players.filter(q=>q.team===p.team&&q.id!==p.id&&!q.keeper)[0];
        const pressure=distance(p,defender);
        if(this.possessionAge>.9&&!this.strike){
          if(!p.keeper&&p.x*d>3.6&&this.teamPasses>0&&Math.abs(p.z)<3.7)this.windup(p,null);
          else if(mate&&distance(p,mate)>1.7&&(p.keeper||pressure<1.5||this.possessionAge>2.4))this.windup(p,mate);
        }
      }else if(p.keeper){
        this.action(p,'guard');tx=-d*9.25;tz=clamp(ball.z*.45,-1.15,1.15);speed=1.35;
        if(ball.owner===null&&ball.x*d<-6){tx=clamp(ball.x,-9.8,9.8);tz=clamp(ball.z,-2.4,2.4);speed=2.1;}
      }else if(ball.owner===null){
        const receiving=this.passTarget!==null&&this.players[this.passTarget].team===p.team?this.passTarget===p.id:pressing[p.team]===p.id;
        this.action(p,receiving?'receive':'support');
        tx=receiving?ball.x+ball.vx*.16:ball.x-d*1.5;tz=receiving?ball.z+ball.vz*.16:clamp(-ball.z,-3.5,3.5);
        speed=receiving?2.25:1.65;
      }else if(owner?.team===p.team){
        this.action(p,'support');tx=clamp(owner.x+d*2.6,-7.5,7.5);tz=owner.z>0?-2.7:2.7;
      }else if(pressing[p.team]===p.id){
        this.action(p,'press');tx=ball.x+ball.vx*.1;tz=ball.z+ball.vz*.1;speed=1.95;
      }else{
        this.action(p,'mark');const attacker=this.players.find(q=>q.team!==p.team&&!q.keeper&&q.id!==owner?.id)!;
        tx=attacker.x-d*.7;tz=attacker.z*.85;
      }
      tx=clamp(tx,-10,10);tz=clamp(tz,-4.6,4.6);
      let dx=tx-p.x,dz=tz-p.z,len=Math.hypot(dx,dz),vx=len>.12?dx/len*Math.min(speed,len*3):0,vz=len>.12?dz/len*Math.min(speed,len*3):0;
      // Yield to nearby bodies rather than running through a team mate.
      if(!kicking)for(const q of this.players){if(p===q)continue;dx=p.x-q.x;dz=p.z-q.z;len=Math.hypot(dx,dz);if(len<.7&&len>.001){vx+=dx/len*(.7-len)*4;vz+=dz/len*(.7-len)*4;}}
      const blend=1-Math.exp(-dt*7);p.vx+=(vx-p.vx)*blend;p.vz+=(vz-p.vz)*blend;
      const beforeX=p.x,beforeZ=p.z;p.x=clamp(p.x+p.vx*dt,-10.1,10.1);p.z=clamp(p.z+p.vz*dt,-4.7,4.7);
      p.walked+=Math.hypot(p.x-beforeX,p.z-beforeZ);
      const facing=kicking?Math.atan2(this.strike!.x-p.x,this.strike!.z-p.z):Math.hypot(p.vx,p.vz)>.16?Math.atan2(p.vx,p.vz):Math.atan2(ball.x-p.x,ball.z-p.z);
      p.heading=turn(p.heading,facing,dt*(kicking?12:6));
      const look=Math.atan2(ball.x-p.x,ball.z-p.z)-p.heading;p.look=clamp(Math.atan2(Math.sin(look),Math.cos(look)),-.65,.65);
      p.touch=p.action==='dribble'&&!kicking?(this.possessionAge%.46)/.46:0;
    }
    if(this.restartAge>=0){
      this.restartAge+=dt;const u=clamp((this.restartAge-.7)/2,0,1),s=u*u*(3-2*u);
      const receiver=this.players[this.restartTeam*3],tx=receiver.x+direction(receiver.team)*.3,tz=receiver.z+.055;
      ball.x=this.restartFrom.x*(1-s)+tx*s;ball.z=this.restartFrom.z*(1-s)+tz*s;ball.y=SOCCER.ballRadius;ball.roll+=dt*3;
      if(this.restartAge>3){this.restartAge=-1;this.ball.owner=receiver.id;this.possessionAge=0;this.teamPasses=0;this.announce((receiver.team?'Blue':'Red')+' kick-off');}
      return;
    }
    if(ball.owner!==null){
      const p=this.players[ball.owner],pulse=(this.possessionAge%.46)/.46,lead=this.strike?.player===p.id?.29:.25+Math.sin(pulse*Math.PI)*.12;
      const right=.055,tx=p.x+Math.sin(p.heading)*lead+Math.cos(p.heading)*right,tz=p.z+Math.cos(p.heading)*lead-Math.sin(p.heading)*right;
      const a=1-Math.exp(-dt*18),dx=(tx-ball.x)*a,dz=(tz-ball.z)*a;
      ball.x+=dx;ball.z+=dz;ball.y=SOCCER.ballRadius+Math.sin(pulse*Math.PI)*.012;ball.roll+=Math.hypot(dx,dz)/SOCCER.ballRadius;
      if(pulse<dt/.46)this.stats.touches++;
      if(!this.strike&&this.possessionAge>.45){const challenger=this.players.find(q=>q.team!==p.team&&distance(q,ball)<.32);if(challenger)this.capture(challenger);}
    }else{
      ball.x+=ball.vx*dt;ball.z+=ball.vz*dt;ball.y+=ball.vy*dt;ball.vy-=9.8*dt;
      if(ball.y<SOCCER.ballRadius){ball.y=SOCCER.ballRadius;ball.vy=Math.abs(ball.vy)>.4?-ball.vy*.3:0;}
      const friction=Math.exp(-dt*(ball.y<=SOCCER.ballRadius+.005?.7:.04));ball.vx*=friction;ball.vz*=friction;
      ball.roll+=Math.hypot(ball.vx,ball.vz)*dt/SOCCER.ballRadius;
      if(Math.abs(ball.x)>SOCCER.goalX&&Math.abs(ball.z)<SOCCER.goalHalfWidth&&ball.y<1.95){
        const scoring=ball.x>0?0:1;this.score[scoring]++;this.stats.goals++;this.announce((scoring?'Blue':'Red')+' goal!');
        ball.x=clamp(ball.x,-11.15,11.15);ball.owner=null;ball.vx=ball.vy=ball.vz=0;this.strike=undefined;this.passTarget=null;this.players.forEach(p=>p.kick=0);
        this.restartTeam=1-scoring;this.restartAge=0;this.restartFrom={x:ball.x,z:ball.z};return;
      }
      if(Math.abs(ball.x)>10.65||Math.abs(ball.z)>5.15){ball.x=clamp(ball.x,-10.6,10.6);ball.z=clamp(ball.z,-5.1,5.1);ball.vx*=.15;ball.vz*=.15;}
      if(ball.y<.26){const receiver=this.players.filter(p=>!(p.id===this.lastKicker&&this.time-this.releaseTime<.65)&&distance(p,ball)<(p.keeper?.45:.33)).sort((a,b)=>distance(a,ball)-distance(b,ball))[0];if(receiver)this.capture(receiver);}
    }
  }
}
