pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
-- orbital mechanic
-- slingshot between planets
-- rescue stranded crew

-- globals
ship={}
planets={}
astros={}
enemies={}
warnings={}
blackholes={}
particles={}
stars={}
trail={}
level=1
max_levels=8
state="title"
tether=nil
tether_dir=0
tether_dist=0
rescued=0
needed=0
shake=0
flash=0
deaths=0
title_t=0
dead_t=0
complete_t=0
win_t=0
shield_t=0
shield_cd=0
enemy_spawn_t=0
intro_t=0
death_cause=""
sel_idx=1
t=0

function _init()
 for i=1,100 do
  add(stars,{
   x=rnd(128),
   y=rnd(128),
   b=rnd(1)>0.7 and 7 or
     rnd(1)>0.5 and 6 or 5,
   sp=rnd(0.3)+0.05
  })
 end
 init_title()
end

function init_title()
 state="title"
 title_t=0
end

function make_planet(x,y,r,m,c1,c2)
 add(planets,{
  x=x,y=y,r=r,m=m,
  c1=c1,c2=c2 or c1
 })
end

function make_astro(x,y)
 add(astros,{
  x=x,y=y,rescued=false,
  bob=rnd(1)
 })
end

function make_blackhole(cx,cy,orbit_r,speed,phase)
 add(blackholes,{
  cx=cx,cy=cy,
  orbit_r=orbit_r,
  speed=speed,
  phase=phase,
  x=cx+cos(phase)*orbit_r,
  y=cy+sin(phase)*orbit_r,
  t=0
 })
end

function init_level(n)
 level=n
 planets={}
 astros={}
 enemies={}
 warnings={}
 blackholes={}
 particles={}
 trail={}
 tether=nil
 rescued=0
 shake=0
 flash=0
 shield_t=0
 shield_cd=0
 enemy_spawn_t=0

 ship={
  x=20,y=64,
  vx=0,vy=-0.6,
  alive=true,cd=0,bh_cd=0
 }

 if n==1 then
  -- single planet, easy orbit
  -- spawn far out, drifting toward planet
  ship.x=10 ship.y=115
  ship.vx=0.4 ship.vy=-0.3
  make_planet(64,64,12,0.15,12,7)
  -- orbit path ~25px from center
  make_astro(85,48)
  needed=1
 elseif n==2 then
  -- two planets, transfer orbit
  ship.x=15 ship.y=70
  ship.vx=0.3 ship.vy=-0.5
  make_planet(45,55,10,0.12,11,3)
  make_planet(95,65,9,0.10,14,15)
  -- flyby p1 orbit
  make_astro(62,38)
  -- flyby p2 orbit
  make_astro(108,82)
  needed=2
 elseif n==3 then
  -- triangle of planets
  ship.x=5 ship.y=64
  ship.vx=0.35 ship.vy=-0.15
  make_planet(64,30,11,0.14,4,5)
  make_planet(30,90,9,0.10,8,9)
  make_planet(100,90,10,0.12,12,7)
  -- flyby p1
  make_astro(64,52)
  -- flyby p2
  make_astro(14,78)
  -- flyby p3
  make_astro(116,76)
  needed=3
 elseif n==4 then
  -- big + small moons
  ship.x=64 ship.y=122
  ship.vx=0 ship.vy=-0.5
  make_planet(64,55,16,0.22,1,13)
  make_planet(25,25,5,0.04,10,11)
  make_planet(103,25,5,0.04,10,11)
  -- paired black holes orbiting big planet
  make_blackhole(64,55,36,0.0025,0)
  make_blackhole(64,55,36,0.0025,0.5)
  -- flyby p2 (left moon)
  make_astro(12,30)
  -- flyby p3 (right moon)
  make_astro(116,30)
  -- between moons, past big planet
  make_astro(64,30)
  needed=3
 elseif n==5 then
  -- gauntlet run
  ship.x=8 ship.y=64
  ship.vx=0 ship.vy=-0.7
  make_planet(35,40,8,0.08,3,11)
  make_planet(65,80,8,0.08,14,15)
  make_planet(95,35,8,0.08,8,9)
  make_planet(65,15,6,0.05,4,5)
  -- flyby p1
  make_astro(22,30)
  -- flyby p2
  make_astro(78,70)
  -- flyby p3
  make_astro(108,48)
  -- flyby p4
  make_astro(52,18)
  needed=4
 elseif n==6 then
  -- binary system
  ship.x=10 ship.y=15
  ship.vx=0.3 ship.vy=0.35
  make_planet(42,60,13,0.17,9,10)
  make_planet(86,60,13,0.17,12,7)
  -- flyby p1 upper orbit
  make_astro(28,44)
  -- flyby p2 upper orbit
  make_astro(100,44)
  -- flyby p1 lower orbit
  make_astro(28,78)
  -- flyby p2 lower orbit
  make_astro(100,78)
  -- gap between both planets
  make_astro(64,60)
  needed=5
 elseif n==7 then
  -- dense field
  ship.x=5 ship.y=64
  ship.vx=0.2 ship.vy=-0.6
  make_planet(30,30,7,0.07,14,15)
  make_planet(80,20,8,0.09,8,9)
  make_planet(25,85,9,0.10,11,3)
  make_planet(90,70,7,0.07,4,5)
  make_planet(60,50,6,0.05,13,6)
  -- portal pair: entry near start, exit by pocket
  make_blackhole(45,62,3,0.002,0)
  make_blackhole(116,112,2,0.002,0.5)
  -- flyby p1
  make_astro(18,18)
  -- flyby p2
  make_astro(93,32)
  -- isolated pocket astro (use black hole)
  make_astro(118,118)
  -- flyby p4
  make_astro(102,58)
  -- flyby p5
  make_astro(72,45)
  needed=5
 elseif n==8 then
  -- the beast - big center + ring
  ship.x=64 ship.y=124
  ship.vx=0 ship.vy=-0.85
  make_planet(64,58,20,0.30,1,13)
  make_planet(20,20,4,0.03,10,11)
  make_planet(108,20,4,0.03,10,11)
  make_planet(20,100,4,0.03,10,11)
  make_planet(108,100,4,0.03,10,11)
  -- flyby corner moons
  make_astro(32,16)
  make_astro(96,16)
  make_astro(32,104)
  make_astro(96,104)
  -- skim past big planet
  make_astro(40,58)
  make_astro(88,58)
  needed=6
 end

 state="play"
end

-->8
-- update

function _update60()
 t+=1
 if state=="title" then
  update_title()
 elseif state=="intro" then
  update_intro()
 elseif state=="select" then
  update_select()
 elseif state=="play" then
  update_play()
 elseif state=="dead" then
  update_dead()
 elseif state=="levelcomplete" then
  update_lc()
 elseif state=="win" then
  update_win()
 end
end

function update_title()
 title_t+=1
 if btnp(4) or btnp(5) then
  state="intro"
  intro_t=0
 end
end

function update_intro()
 intro_t+=1
 if btnp(4) or btnp(5) then
  if intro_t<140 then
   intro_t=140
  else
   state="select"
  end
 end
end

function update_select()
 if btnp(0) then
  sel_idx-=1
  if sel_idx<1 then sel_idx=8 end
  sfx(0)
 elseif btnp(1) then
  sel_idx+=1
  if sel_idx>8 then sel_idx=1 end
  sfx(0)
 elseif btnp(2) then
  sel_idx-=4
  if sel_idx<1 then sel_idx+=8 end
  sfx(0)
 elseif btnp(3) then
  sel_idx+=4
  if sel_idx>8 then sel_idx-=8 end
  sfx(0)
 elseif btnp(4) or btnp(5) then
  init_level(sel_idx)
 end
end

function level_needed(n)
 if n==1 then return 1 end
 if n==2 then return 2 end
 if n==3 then return 3 end
 if n==4 then return 3 end
 if n==5 then return 4 end
 if n==6 then return 5 end
 if n==7 then return 5 end
 if n==8 then return 6 end
 return 0
end

function update_play()
 -- cooldown
 if ship.cd>0 then ship.cd-=1 end
 if shield_cd>0 then shield_cd-=1 end
 if shield_t>0 then shield_t-=1 end

 -- z: tether toggle
 if btnp(4) then
  if tether then
   release_tether()
  elseif ship.cd<=0 then
   try_tether()
  end
 end

 -- x: shield bubble
 if btnp(5) and shield_cd<=0 then
  shield_t=18
  shield_cd=45
  sfx(0)
 end

 -- physics
 if tether then
  update_tethered()
 else
  update_freefly()
 end

 -- move
 ship.x+=ship.vx
 ship.y+=ship.vy

 update_blackholes()
 check_blackhole_capture()
 update_enemies()

 -- trail
 if t%2==0 then
  add(trail,{
   x=ship.x,y=ship.y,
   life=40
  })
 end
 update_trail()

 -- collisions
 for _,p in pairs(planets) do
  local d=dist(ship.x,ship.y,p.x,p.y)
  if d<p.r+1.5 then
   kill_ship("planet")
   return
  end
 end

 -- bounds check
 if ship.x<-20 or ship.x>148
  or ship.y<-20 or ship.y>148
 then
  kill_ship("bounds")
  return
 end

 -- rescue check
 for _,a in pairs(astros) do
  if not a.rescued then
   if dist(ship.x,ship.y,
           a.x,a.y)<7 then
    a.rescued=true
    rescued+=1
    sfx(2)
    spawn_burst(a.x,a.y,11,10)
    spawn_burst(a.x,a.y,7,6)
    if rescued>=needed then
     state="levelcomplete"
     complete_t=0
     sfx(3)
    end
   end
  end
 end

 update_particles()
 if shake>0 then shake*=0.9 end
 if flash>0 then flash-=1 end
end

function try_tether()
 local best_d=45
 local best_i=nil
 for i,p in pairs(planets) do
  local d=dist(ship.x,ship.y,
               p.x,p.y)
  if d<best_d and d>p.r+5 then
   best_d=d
   best_i=i
  end
 end
 if best_i then
  tether=best_i
  local p=planets[best_i]
  local dx=ship.x-p.x
  local dy=ship.y-p.y
  tether_dist=sqrt(dx*dx+dy*dy)
  -- rotation direction
  local cross=dx*ship.vy-dy*ship.vx
  tether_dir=cross<0 and 1 or -1
  sfx(0)
 end
end

function release_tether()
 -- small slingshot boost
 local spd=sqrt(
  ship.vx*ship.vx+
  ship.vy*ship.vy)
 local boost=1.12
 ship.vx*=boost
 ship.vy*=boost
 tether=nil
 ship.cd=12
 -- particles
 for i=1,10 do
  add(particles,{
   x=ship.x,y=ship.y,
   vx=ship.vx*-0.3+rnd(1.5)-0.75,
   vy=ship.vy*-0.3+rnd(1.5)-0.75,
   life=15+rnd(10),
   col=10,sz=1
  })
 end
 sfx(1)
end

function update_tethered()
 local p=planets[tether]
 local dx=ship.x-p.x
 local dy=ship.y-p.y
 local d=tether_dist
 local spd=sqrt(
  ship.vx*ship.vx+
  ship.vy*ship.vy)

 -- angular velocity (pico8 turns)
 local omega=tether_dir*spd/
  (d*6.2832)

 local ang=atan2(dx,dy)
 ang+=omega

 -- update position
 ship.x=p.x+cos(ang)*d
 ship.y=p.y+sin(ang)*d

 -- tangential velocity
 ship.vx=tether_dir*sin(ang)*spd
 ship.vy=-tether_dir*cos(ang)*spd

 -- tether sparkles
 if t%3==0 then
  local tt=rnd(1)
  add(particles,{
   x=lerp(ship.x,p.x,tt),
   y=lerp(ship.y,p.y,tt),
   vx=rnd(0.4)-0.2,
   vy=rnd(0.4)-0.2,
   life=8+rnd(5),col=10,sz=0
  })
 end
end

function update_freefly()
 for _,p in pairs(planets) do
  local dx=p.x-ship.x
  local dy=p.y-ship.y
  local d=sqrt(dx*dx+dy*dy)
  if d>p.r then
   local f=p.m/(d*d)
   f=min(f,0.04)
   ship.vx+=dx/d*f
   ship.vy+=dy/d*f
  end
 end
end

function kill_ship(cause)
 death_cause=cause or "bounds"
 ship.alive=false
 state="dead"
 dead_t=0
 deaths+=1
 shake=6
 flash=3
 tether=nil
 sfx(4)
 for i=1,25 do
  local ang=rnd(1)
  local spd=rnd(2.5)+0.5
  add(particles,{
   x=ship.x,y=ship.y,
   vx=cos(ang)*spd,
   vy=sin(ang)*spd,
   life=25+rnd(20),
   col=rnd(1)>0.5 and 8 or 9,
   sz=rnd(1)>0.5 and 1 or 0
  })
 end
 -- debris
 for i=1,8 do
  local ang=rnd(1)
  add(particles,{
   x=ship.x,y=ship.y,
   vx=cos(ang)*rnd(1.5),
   vy=sin(ang)*rnd(1.5),
   life=40+rnd(20),col=7,sz=0
  })
 end
end

function update_dead()
 dead_t+=1
 update_particles()
 if shake>0 then shake*=0.9 end
 if flash>0 then flash-=1 end
 if dead_t>50 and
   (btnp(4) or btnp(5)) then
  init_level(level)
 end
end

function update_lc()
 complete_t+=1
 update_particles()
 -- victory sparkles
 if complete_t%4==0 then
  add(particles,{
   x=rnd(128),y=rnd(60),
   vx=0,vy=rnd(0.3)+0.1,
   life=30+rnd(20),
   col=rnd(1)>0.5 and 10 or 11,
   sz=0
  })
 end
 if complete_t>50 and
   (btnp(4) or btnp(5)) then
  if level>=max_levels then
   state="win"
   win_t=0
  else
   init_level(level+1)
  end
 end
end

function update_win()
 win_t+=1
 if win_t>80 and
   (btnp(4) or btnp(5)) then
  deaths=0
  init_title()
 end
end

function update_blackholes()
 for bh in all(blackholes) do
  bh.phase+=bh.speed
  bh.x=bh.cx+cos(bh.phase)*bh.orbit_r
  bh.y=bh.cy+sin(bh.phase)*bh.orbit_r
  bh.t+=1
 end
end

function check_blackhole_capture()
 if ship.bh_cd>0 then
  ship.bh_cd-=1
  return
 end
 if #blackholes<2 then return end
 for i=1,#blackholes do
  local bh=blackholes[i]
  if dist(ship.x,ship.y,
          bh.x,bh.y)<4 then
   local other=blackholes[
    i==1 and 2 or 1]
   -- force release tether
   if tether then
    tether=nil
    ship.cd=0
   end
   -- nudge out along current
   -- velocity so we don't
   -- immediately re-enter
   local spd=sqrt(
    ship.vx*ship.vx+
    ship.vy*ship.vy)
   if spd<0.1 then spd=0.1 end
   ship.x=other.x+ship.vx/spd*5
   ship.y=other.y+ship.vy/spd*5
   ship.bh_cd=25
   spawn_burst(bh.x,bh.y,13,14)
   spawn_burst(other.x,other.y,
    13,14)
   spawn_burst(other.x,other.y,
    7,6)
   shake=max(shake,3)
   sfx(5)
   return
  end
 end
end

function spawn_warning()
 local side=flr(rnd(4))
 local x,y
 if side==0 then
  x=-8 y=rnd(120)+4
 elseif side==1 then
  x=136 y=rnd(120)+4
 elseif side==2 then
  x=rnd(120)+4 y=-8
 else
  x=rnd(120)+4 y=136
 end
 add(warnings,{
  x=x,y=y,
  side=side,
  t=45
 })
end

function spawn_enemy_at(x,y)
 local dx=ship.x-x
 local dy=ship.y-y
 local d=sqrt(dx*dx+dy*dy)
 if d<1 then d=1 end
 add(enemies,{
  x=x,y=y,
  vx=dx/d*0.45,
  vy=dy/d*0.45,
  t=rnd(10)
 })
end

function update_enemies()
 enemy_spawn_t+=1
 local spawn_rate=max(90,200-level*14)
 local cap=2+flr(level/2)
 local pending=#enemies+#warnings
 if enemy_spawn_t>spawn_rate
   and pending<cap then
  spawn_warning()
  enemy_spawn_t=0
 end

 -- tick warnings
 for i=#warnings,1,-1 do
  local w=warnings[i]
  w.t-=1
  if w.t<=0 then
   spawn_enemy_at(w.x,w.y)
   deli(warnings,i)
  end
 end

 for i=#enemies,1,-1 do
  local e=enemies[i]
  local dx=ship.x-e.x
  local dy=ship.y-e.y
  local d=sqrt(dx*dx+dy*dy)
  -- home toward ship
  if d>0.5 then
   e.vx+=dx/d*0.025
   e.vy+=dy/d*0.025
  end
  -- drag + speed cap
  e.vx*=0.98
  e.vy*=0.98
  local sp=sqrt(
   e.vx*e.vx+e.vy*e.vy)
  if sp>1.2 then
   e.vx*=1.2/sp
   e.vy*=1.2/sp
  end
  e.x+=e.vx
  e.y+=e.vy
  e.t+=1

  -- shield destroys enemy
  local killed=false
  if shield_t>0 and d<11 then
   spawn_burst(e.x,e.y,8,8)
   spawn_burst(e.x,e.y,10,4)
   deli(enemies,i)
   killed=true
   shake=max(shake,2)
   sfx(2)
  end

  if not killed then
   -- hit ship
   if d<3.5 then
    kill_ship("enemy")
    return
   end
   -- offscreen cleanup
   if e.x<-20 or e.x>148
     or e.y<-20 or e.y>148
   then
    if e.t>60 then
     deli(enemies,i)
    end
   end
  end
 end
end

function update_trail()
 for i=#trail,1,-1 do
  trail[i].life-=1
  if trail[i].life<=0 then
   deli(trail,i)
  end
 end
end

function update_particles()
 for i=#particles,1,-1 do
  local p=particles[i]
  p.x+=p.vx
  p.y+=p.vy
  p.vx*=0.97
  p.vy*=0.97
  p.life-=1
  if p.life<=0 then
   deli(particles,i)
  end
 end
end

-->8
-- draw

function _draw()
 if state=="title" then
  draw_title()
 elseif state=="intro" then
  draw_intro()
 elseif state=="select" then
  draw_select()
 elseif state=="win" then
  draw_win()
 else
  draw_game()
 end
end

function draw_select()
 cls(0)
 draw_starfield()

 print("select sector",36,12,7)
 print("select sector",36,13,1)

 local gx=14
 local gy=30
 local cw=26
 local ch=28
 for i=1,8 do
  local col=(i-1)%4
  local row=flr((i-1)/4)
  local x=gx+col*cw
  local y=gy+row*ch
  local sel=i==sel_idx
  if sel then
   rectfill(x,y,
    x+cw-4,y+ch-4,1)
   rect(x-1,y-1,
    x+cw-3,y+ch-3,
    t%8<4 and 10 or 7)
  else
   rect(x,y,
    x+cw-4,y+ch-4,5)
  end
  -- level number
  local lc=sel and 10 or 6
  print(i,
   x+cw/2-3,y+3,lc)
  -- needed pips
  local n=level_needed(i)
  for j=1,n do
   circfill(
    x+3+(j-1)*3,
    y+ch-9,
    1,sel and 11 or 3)
  end
 end

 -- description of selected
 local desc={
  "[1] solo orbit",
  "[2] transfer lanes",
  "[3] triangle pass",
  "[4] moons + portal",
  "[5] gauntlet run",
  "[6] binary system",
  "[7] dense + pocket",
  "[8] the beast"
 }
 print(desc[sel_idx],
  32,94,6)

 print("\x8b\x91\x94\x83 choose",30,108,5)
 if t%40<25 then
  print("\x8e/\x97 begin",36,118,10)
 end
end

function draw_intro()
 cls(0)
 draw_starfield()

 local lines={
  {t="        2387",c=10},
  {t="",c=0},
  {t="  the aegis broke apart",c=6},
  {t="  in transit. her crew",c=6},
  {t="  drift between worlds.",c=6},
  {t="",c=0},
  {t="  you fly the last sled.",c=7},
  {t="  no engines - only",c=7},
  {t="  gravity and a tether.",c=7},
  {t="",c=0},
  {t="  something circles the",c=8},
  {t="  wreck, drawn to their",c=8},
  {t="  distress beacons.",c=8},
  {t="",c=0},
  {t="  bring them home.",c=11},
 }

 local y=18
 for i,l in ipairs(lines) do
  local at=i*8
  if intro_t>at then
   local age=intro_t-at
   local c=l.c
   if age<6 and c>0 then
    c=l.c==11 and 3 or 5
   end
   print(l.t,0,y,c)
  end
  y+=6
 end

 -- drifting debris
 if intro_t%6==0 then
  add(particles,{
   x=-4,y=rnd(128),
   vx=rnd(0.3)+0.1,vy=0,
   life=400,col=5,sz=0
  })
 end
 update_particles()
 for _,p in pairs(particles) do
  pset(p.x,p.y,p.col)
 end

 if intro_t>150 and intro_t%60<40 then
  print("\x8e/\x97 begin",44,120,10)
 end
end

function draw_title()
 cls(0)
 draw_starfield()

 -- logo
 local y=20+sin(title_t/120)*3

 -- "orbit" in big energy letters
 local ox=53
 rectfill(ox,y,ox+22,y+11,0)
 print("orbit",ox+1,y,7)
 print("orbit",ox+1,y+1,1)
 print("orbit",ox+2,y,6)

 -- animated demo
 local cx,cy=64,58
 local r1=18
 local r2=28
 -- planet
 circfill(cx,cy,10,1)
 circfill(cx,cy,8,12)
 circfill(cx-3,cy-3,3,7)
 circ(cx,cy,11,13)

 -- orbit rings
 circ(cx,cy,r1,5)
 circ(cx,cy,r2,5)

 -- orbiting ship
 local a1=title_t/90
 local sx=cx+cos(a1)*r1
 local sy=cy+sin(a1)*r1

 -- tether line (dashed)
 for i=0,1,0.08 do
  if (i*12)%2<1 then
   pset(
    lerp(sx,cx,i),
    lerp(sy,cy,i),10)
  end
 end

 -- ship dot
 circfill(sx,sy,2,7)
 pset(sx,sy,10)

 -- astronaut on outer ring
 local a2=title_t/150+0.3
 local ax=cx+cos(a2)*r2
 local ay=cy+sin(a2)*r2
 if sin(t/15)>0 then
  circ(ax,ay,3+sin(t/20),7)
 end
 circfill(ax,ay,2,
  sin(t/10)>0 and 7 or 6)

 -- instructions
 print("slingshot between",22,90,6)
 print("planets to rescue",22,97,6)
 print("stranded astronauts",19,104,6)

 if title_t%60<40 then
  print("\x8e tether  \x97 shield",19,118,10)
 end
end

function draw_game()
 -- screen flash on death
 if flash>0 then
  cls(7)
 else
  cls(0)
 end

 -- screenshake offset
 local sx,sy=0,0
 if shake>0.5 then
  sx=rnd(shake*2)-shake
  sy=rnd(shake*2)-shake
 end
 camera(-sx,-sy)

 draw_starfield()

 -- gravity wells (subtle)
 for _,p in pairs(planets) do
  circ(p.x,p.y,p.r+8,1)
 end

 -- trail
 for _,tr in pairs(trail) do
  local c=1
  if tr.life>30 then c=13
  elseif tr.life>20 then c=5
  elseif tr.life>10 then c=1
  end
  pset(tr.x,tr.y,c)
 end

 -- tether line
 if tether and ship.alive then
  local p=planets[tether]
  draw_tether(ship.x,ship.y,
              p.x,p.y)
 end

 -- tether range indicator
 if not tether and ship.alive
   and ship.cd<=0 then
  local best_d=45
  local best_p=nil
  for _,p in pairs(planets) do
   local d=dist(ship.x,ship.y,
                p.x,p.y)
   if d<best_d and d>p.r+5 then
    best_d=d
    best_p=p
   end
  end
  if best_p then
   local pulse=sin(t/20)*2
   circ(best_p.x,best_p.y,
        best_p.r+5+pulse,
        t%8<4 and 10 or 1)
  end
 end

 -- planets
 for _,p in pairs(planets) do
  draw_planet(p)
 end

 -- black holes + pair link
 if #blackholes>=2 then
  local a=blackholes[1]
  local b=blackholes[2]
  for i=0,1,0.08 do
   if (i*10+t/6)%2<1 then
    pset(
     lerp(a.x,b.x,i),
     lerp(a.y,b.y,i),
     t%8<4 and 13 or 1)
   end
  end
 end
 for _,bh in pairs(blackholes) do
  draw_blackhole(bh)
 end

 -- astronauts
 for _,a in pairs(astros) do
  if not a.rescued then
   draw_astronaut(a)
  end
 end

 -- particles
 for _,p in pairs(particles) do
  if p.sz>0 then
   circfill(p.x,p.y,p.sz,p.col)
  else
   pset(p.x,p.y,p.col)
  end
 end

 -- enemies
 for _,e in pairs(enemies) do
  draw_enemy(e)
 end

 -- edge warnings
 for _,w in pairs(warnings) do
  draw_warning(w)
 end

 -- ship
 if ship.alive then
  draw_ship()
  if shield_t>0 then
   draw_shield()
  end
 end

 camera(0,0)

 -- hud
 draw_hud()

 -- overlays
 if state=="dead" then
  draw_death_overlay()
 elseif state=="levelcomplete" then
  draw_complete_overlay()
 end
end

function draw_planet(p)
 -- shadow
 circfill(p.x+1,p.y+1,p.r,0)
 -- body
 circfill(p.x,p.y,p.r,p.c1)
 -- highlight
 circfill(
  p.x-p.r*0.3,
  p.y-p.r*0.3,
  p.r*0.4,p.c2)
 -- rim
 circ(p.x,p.y,p.r,p.c1==1 and 13 or p.c1)
end

function draw_astronaut(a)
 local by=a.y+sin(t/30+a.bob)*2
 -- helmet
 circfill(a.x,by,3,
  sin(t/10+a.bob)>0 and 7 or 6)
 -- visor
 pset(a.x+1,by,12)
 pset(a.x,by,12)
 -- sos rings
 local ring_r=5+sin(t/15+a.bob)*3
 if ring_r>5 then
  circ(a.x,by,ring_r,
   t%20<10 and 8 or 0)
 end
end

function draw_ship()
 -- heading from velocity
 local ang=atan2(ship.vx,ship.vy)
 local nx=cos(ang)
 local ny=sin(ang)
 local px=-ny
 local py=nx

 -- nose
 local x1=ship.x+nx*3.5
 local y1=ship.y+ny*3.5
 -- wings
 local x2=ship.x-nx*2.5+px*2
 local y2=ship.y-ny*2.5+py*2
 local x3=ship.x-nx*2.5-px*2
 local y3=ship.y-ny*2.5-py*2
 -- tail center
 local x4=ship.x-nx*1.5
 local y4=ship.y-ny*1.5

 -- body
 line(x1,y1,x2,y2,7)
 line(x1,y1,x3,y3,7)
 line(x2,y2,x4,y4,6)
 line(x3,y3,x4,y4,6)

 -- engine glow
 if t%4<3 then
  local ec=tether and 10 or
   (t%6<3 and 8 or 9)
  pset(x4,y4,ec)
  if t%4<2 then
   pset(x4-nx*1,y4-ny*1,ec)
  end
 end
end

function draw_blackhole(bh)
 -- faint gravitational halo
 circ(bh.x,bh.y,6,1)
 -- swirling accretion
 for i=0,9 do
  local a=(i/10+bh.t/35)%1
  local r=3+sin(
   a*4+bh.t/18)*0.7
  local step=(i+flr(bh.t/5))%4
  local c=step<2 and 13 or
    (step<3 and 2 or 1)
  pset(
   bh.x+cos(a)*r,
   bh.y+sin(a)*r,c)
 end
 -- dark core
 circfill(bh.x,bh.y,2,0)
 -- singularity spark
 if bh.t%6<3 then
  pset(bh.x,bh.y,7)
 end
end

function draw_warning(w)
 local rate=w.t<15 and 3 or 6
 local c=t%rate<rate/2 and 8 or 10
 if w.side==0 then
  local ay=mid(5,w.y,122)
  line(2,ay-3,5,ay,c)
  line(5,ay,2,ay+3,c)
  line(2,ay-3,2,ay+3,c)
 elseif w.side==1 then
  local ay=mid(5,w.y,122)
  line(125,ay-3,122,ay,c)
  line(122,ay,125,ay+3,c)
  line(125,ay-3,125,ay+3,c)
 elseif w.side==2 then
  local ax=mid(5,w.x,122)
  line(ax-3,2,ax,5,c)
  line(ax,5,ax+3,2,c)
  line(ax-3,2,ax+3,2,c)
 else
  local ax=mid(5,w.x,122)
  line(ax-3,125,ax,122,c)
  line(ax,122,ax+3,125,c)
  line(ax-3,125,ax+3,125,c)
 end
end

function draw_enemy(e)
 -- jagged body that pulses
 local pulse=sin(e.t/6)
 local c1=pulse>0 and 8 or 2
 local c2=pulse>0 and 9 or 8
 circfill(e.x,e.y,2,c1)
 -- spikes
 local sa=e.t/20
 for i=0,3 do
  local a=sa+i/4
  local sx=e.x+cos(a)*3
  local sy=e.y+sin(a)*3
  pset(sx,sy,c2)
 end
 -- core
 pset(e.x,e.y,7)
 -- trail dust
 if t%3==0 then
  add(particles,{
   x=e.x-e.vx,
   y=e.y-e.vy,
   vx=rnd(0.3)-0.15,
   vy=rnd(0.3)-0.15,
   life=6+rnd(6),
   col=2,sz=0
  })
 end
end

function draw_shield()
 local r=4+shield_t*0.25
 local c1=t%4<2 and 12 or 7
 local c2=t%4<2 and 7 or 12
 circ(ship.x,ship.y,r,c1)
 circ(ship.x,ship.y,r+1,c2)
 -- sparkles on rim
 for i=0,4 do
  local a=(t/10+i/5)%1
  pset(
   ship.x+cos(a)*r,
   ship.y+sin(a)*r,10)
 end
end

function draw_tether(x1,y1,x2,y2)
 -- dashed energy line
 local steps=20
 for i=0,steps do
  local tt=i/steps
  local px=lerp(x1,x2,tt)
  local py=lerp(y1,y2,tt)
  -- wave offset
  local perp_x=-(y2-y1)
  local perp_y=(x2-x1)
  local d=sqrt(perp_x*perp_x+
               perp_y*perp_y)
  if d>0 then
   perp_x/=d
   perp_y/=d
  end
  local wave=sin(tt*3+t/15)*1.5
  px+=perp_x*wave
  py+=perp_y*wave

  local c=10
  if i%3==0 then c=9 end
  pset(px,py,c)
 end
end

function draw_starfield()
 for _,s in pairs(stars) do
  local b=s.b
  if sin(t/60+s.x)>0.7 then
   b=7
  end
  pset(s.x,s.y,b)
 end
end

function draw_hud()
 -- level
 print("lv"..level,2,2,13)

 -- rescue count
 for i=1,needed do
  local c=i<=rescued and 11 or 1
  circfill(118-i*7,4,2,c)
  if i<=rescued then
   pset(118-i*7,4,7)
  end
 end

 -- tether state
 if tether then
  rectfill(44,1,82,7,0)
  print("tethered",45,2,10)
 end

 -- shield indicator
 local sx=2
 local sy=120
 print("\x97",sx,sy,
  shield_cd<=0 and 12 or 5)
 if shield_t>0 then
  circ(sx+2,sy+2,3,
   t%4<2 and 12 or 7)
 elseif shield_cd>0 then
  local w=flr(
   (1-shield_cd/45)*10)
  rect(sx+6,sy+2,sx+16,sy+4,1)
  if w>0 then
   rectfill(sx+6,sy+2,
    sx+6+w,sy+4,12)
  end
 else
  print("ready",sx+7,sy,12)
 end
end

function draw_death_overlay()
 if dead_t>25 then
  local hdr,sub,c
  if death_cause=="planet" then
   hdr="planetfall"
   sub="hull crushed"
   c=8
  elseif death_cause=="enemy" then
   hdr="overrun"
   sub="they got you"
   c=8
  else
   hdr="lost in space"
   sub="beyond recall"
   c=12
  end
  rectfill(25,46,103,76,0)
  rect(25,46,103,76,c)
  rect(26,47,102,75,2)
  print(hdr,64-#hdr*2,50,c)
  print(sub,64-#sub*2,58,6)
  if dead_t>50 then
   print("\x8e/\x97 retry",43,67,6)
  end
 end
end

function draw_complete_overlay()
 if complete_t>8 then
  rectfill(18,42,110,76,0)
  rect(18,42,110,76,11)
  rect(19,43,109,75,3)
  print("crew rescued!",32,46,11)
  if level<max_levels then
   print("level "..level.." clear",36,56,7)
  else
   print("final level clear!",26,56,7)
  end
  if complete_t>50 then
   print("\x8e/\x97 continue",34,67,6)
  end
 end
end

function draw_win()
 cls(0)
 draw_starfield()

 -- sparkle particles
 if win_t%3==0 then
  pset(rnd(128),rnd(128),
   rnd(1)>0.5 and 10 or 11)
 end

 local y=18+sin(win_t/60)*2
 print("mission complete",20,y,11)
 print("mission complete",20,y+1,3)

 -- ship home illustration
 local cx,cy=64,55
 -- earth
 circfill(cx,cy,14,12)
 circfill(cx-4,cy-4,5,7)
 circfill(cx+5,cy+3,4,11)
 circfill(cx-2,cy+6,3,7)
 circ(cx,cy,14,1)

 -- orbiting rescued ships
 for i=0,2 do
  local a=win_t/80+i/3
  local ox=cx+cos(a)*20
  local oy=cy+sin(a)*20
  circfill(ox,oy,1,7)
 end

 print("all "..needed.." crew safe",34,78,7)
 print("crashes: "..deaths,40,88,6)

 if deaths==0 then
  print("flawless!",44,98,10)
 elseif deaths<8 then
  print("skilled pilot",36,98,10)
 elseif deaths<20 then
  print("persistent!",40,98,12)
 else
  print("never give up!",34,98,8)
 end

 if win_t>80 and win_t%60<40 then
  print("\x8e/\x97 title",44,116,6)
 end
end

-->8
-- utils

function dist(x1,y1,x2,y2)
 local dx=x2-x1
 local dy=y2-y1
 return sqrt(dx*dx+dy*dy)
end

function lerp(a,b,t)
 return a+(b-a)*t
end

function spawn_burst(x,y,c,n)
 for i=1,n do
  local ang=rnd(1)
  local spd=rnd(2)+0.3
  add(particles,{
   x=x,y=y,
   vx=cos(ang)*spd,
   vy=sin(ang)*spd,
   life=15+rnd(15),
   col=c,
   sz=rnd(1)>0.6 and 1 or 0
  })
 end
end

__gfx__
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
__gff__
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
__map__
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
__sfx__
010400001805018050200502405028050000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
010200002865524655206551c65518655146551065508655046550000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
010800002435028350303502c3502835030350243500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
010c00002455028550285502c5502c55030550305503055030550000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
010200003065728657246572065718657146571065708657046570265700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
01080000302652c2652826524265202651c2651826514265102650c26508265042650226500265000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
__music__

