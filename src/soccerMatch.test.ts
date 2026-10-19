import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SoccerMatch,SOCCER} from './soccerMatch';

const advance=(match:SoccerMatch,seconds:number,rate=60)=>{match.update(0);for(let i=1;i<=seconds*rate;i++)match.update(i/rate);return match;};

test('match decisions are independent of display frame rate and freeze at a repeated clock',()=>{
  const a=advance(new SoccerMatch(),30,30),b=advance(new SoccerMatch(),30,120);
  assert.deepEqual(a.players,b.players);assert.deepEqual(a.ball,b.ball);assert.deepEqual(a.stats,b.stats);
  const before=JSON.stringify([a.players,a.ball,a.stats,a.score]);a.update(30);a.update(30);
  assert.equal(JSON.stringify([a.players,a.ball,a.stats,a.score]),before);
  a.update(0);assert.deepEqual(a.players,new SoccerMatch().players);assert.deepEqual(a.score,[0,0]);
});

test('autonomous players dribble, exchange passes, defend and shoot without leaving the field',()=>{
  const match=new SoccerMatch(),actions=new Set<string>();match.update(0);
  for(let i=1;i<=180*60;i++){
    match.update(i/60);
    for(const p of match.players){
      actions.add(p.action);assert.ok(Number.isFinite(p.walked+p.heading+p.x+p.z+p.vx+p.vz));
      assert.ok(Math.abs(p.x)<=10.11&&Math.abs(p.z)<=4.71);
    }
    assert.ok(Math.abs(match.ball.x)<=11.2&&Math.abs(match.ball.z)<=5.2);
    assert.ok(match.ball.y>=SOCCER.ballRadius&&Number.isFinite(match.ball.roll));
    if(match.ball.owner!==null)assert.ok(Math.hypot(match.ball.x-match.players[match.ball.owner].x,match.ball.z-match.players[match.ball.owner].z)<1,'controlled ball stays within playing reach');
  }
  assert.ok(match.stats.touches>30);assert.ok(match.stats.passes>4);assert.ok(match.stats.receptions>2);
  assert.ok(match.stats.shots>1);assert.ok(match.stats.interceptions+match.stats.tackles>1);
  assert.ok(match.stats.saves>0&&match.stats.goals>0,'keepers can save shots and goals restart play');
  for(const action of ['dribble','pass','receive','press','mark','guard','shoot'])assert.ok(actions.has(action),action);
});
