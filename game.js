(() => {
 'use strict';
 const $=id=>document.getElementById(id),data=window.GAME_DATA,rows=Object.fromEntries(data.rows.map(r=>[r[0],r]));
 const places=[{id:'BAKERY',name:'面包店',x:.09,bg:'BAKERY'},{id:'ALICE',name:'夜校',x:.28,key:'alice',bg:'CLASSROOM'},{id:'PARK',name:'公园',x:.49,bg:'PARK'},{id:'DOCTOR',name:'咨询室',x:.75,key:'doctor',bg:'COUNSEL'},{id:'NEMUR',name:'实验室',x:.95,key:'nemur',bg:'LAB'}];
 const labels={STREET:'城市街道',BAKERY:'唐纳的面包店',CLASSROOM:'夜校',COUNSEL:'心理咨询室',LAB:'研究实验室',PARK:'公园',DOOR:'面包店门口'};
 let state,mode='intro',current=null,lastDoor='BAKERY',pos=.09,target=null,held=0,lastTime=0,history=[],timer,transitioning=false;
 const reset=()=>{state={seen:false,visits:new Set(),choice:null,done:false};history=[];lastDoor='BAKERY';pos=.09;target=null;held=0;$('walker').style.transform='translateX(-50%) scaleX(1)';};reset();
 const asset=k=>data.assets[k];
 function background(k){if(window.MediaCache)return window.MediaCache.background($('scene'),asset(k));$('scene').style.backgroundImage=`url("${asset(k)}")`;}
 background('STREET');$('streetImg').src=asset('STREET');$('walker').src=asset('WALKER');$('walker').alt='查理的卡通小人物';
 function show(which){mode=which;window.GameAudio?.setMode(which);$('game').classList.toggle('is-story',which==='story');window.Opening?.setActive(which==='intro');['intro','street','story'].forEach(x=>$(x).hidden=x!==which);document.querySelector('.shade').style.background=which==='intro'?'linear-gradient(90deg,rgba(14,43,51,.86),rgba(14,43,51,.12) 85%)':which==='street'?'#1c4d5970':'linear-gradient(0deg,#183d4966,transparent 75%)';}
 function toast(t){$('toast').textContent=t;$('toast').style.display='block';clearTimeout(timer);timer=setTimeout(()=>$('toast').style.display='none',2400);}
 function street(){show('street');background('STREET');current=null;target=null;held=0;pos=places.find(p=>p.id===lastDoor).x;$('taskText').textContent=!state.seen?'先去面包店看看。也可以沿街走走。':!state.visits.size?'找人谈谈吉姆比的事。夜校、咨询室、实验室都可以拜访。':'我听到了一些想法。可以继续咨询，也可以回面包店作决定。';$('doors').replaceChildren();places.forEach(p=>{let b=document.createElement('button');b.className='door';b.style.left=`${p.x*100}%`;b.innerHTML=`${p.name}<small>${p.key&&state.visits.has(p.key)?'已咨询 · 可以重看':'点击前往'}</small>`;b.onclick=()=>{if(Math.abs(pos-p.x)<.045)enter(p);else target=p.x;};b.dataset.place=p.id;$('doors').append(b);});position();}
 function position(){const w=$('world').offsetWidth,v=$('street').clientWidth;const offset=Math.max(0,Math.min(w-v,pos*w-v/2));$('world').style.transform=`translateX(${-offset}px)`;$('walker').style.left=`${pos*100}%`;const near=places.find(p=>Math.abs(p.x-pos)<.045);$('enterBtn').disabled=!near;$('enterBtn').textContent=near?`进入${near.name} · E`:'走近一个地点';document.querySelectorAll('.door').forEach(b=>b.classList.toggle('active',b.dataset.place===near?.id));}
 function enter(p){if(mode!=='street'||!p)return;lastDoor=p.id;target=null;held=0;if(p.id==='PARK')return go('PARK-01');if(p.id==='BAKERY')return go(!state.seen?'OBS-01':!state.visits.size?'LOCK-01':'DECIDE');go(!state.seen?`${p.id}-PRE-01`:state.visits.has(p.key)?`${p.id}-REVIEW-01`:`${p.id}-TALK-01`);}
 function choose(items){$('next').hidden=true;const box=$('choices');box.replaceChildren();items.forEach(([text,fn])=>{let b=document.createElement('button');b.textContent=text;b.onclick=()=>{if(transitioning)return;transitioning=true;fn();setTimeout(()=>transitioning=false,180);};box.append(b);});}
 function renderCast(r){
  const name=['查理','吉姆比','唐纳','爱丽丝','斯特劳斯','尼姆教授'].find(n=>r[4].includes(n))||'查理';
  const cast=$('cast');
  if(cast.dataset.character===name)return;
  cast.dataset.character=name;cast.replaceChildren();
  const slot=document.createElement('div');slot.className='portrait is-speaking';
  const img=document.createElement('img');img.decoding='async';img.src=asset(name);img.alt=name;slot.append(img);cast.append(slot);
 }
 function go(id){if(id==='STREET')return street();if(id.endsWith('-DONE')){const p=places.find(p=>id.startsWith(p.id+'-'));state.visits.add(p.key);toast('已经听过这份建议。现在可以回面包店作决定。');return street();}
  const r=rows[id];if(!r)throw new Error('未知节点 '+id);current=id;clearTimeout(timer);$('toast').style.display='none';show('story');background(r[2]);$('sceneLabel').textContent=labels[r[2]];$('speaker').textContent=r[4]==='系统'?'此刻的选择':r[4];$('line').textContent=r[5];$('choices').replaceChildren();$('next').hidden=false;renderCast(r);
  const group=id.replace(/-\d+$/,'');const groupRows=data.rows.filter(x=>x[0].startsWith(group+'-')&&/\d$/.test(x[0]));$('page').textContent=groupRows.length?`${groupRows.findIndex(x=>x[0]===id)+1} / ${groupRows.length}`:'';
  if(id==='DECIDE'){ $('line').textContent='我该怎样处理吉姆比的事？';choose([['私下找吉姆比谈谈',()=>{state.choice='private';go('PRIVATE-01');}],['告诉唐纳先生',()=>{state.choice='report';go('REPORT-01');}]]);}
  else if(id.endsWith('-MENU')){const person=id.replace('-MENU','');$('line').textContent='还想再听一遍吗？';choose([['重看对话',()=>go(person+'-TALK-01')],['返回街道',street]]);}
  else if(id==='FINISH'){state.done=true;$('speaker').textContent='本段结束';$('line').textContent='我作出了自己的选择。';choose([['重新体验',()=>{reset();street();}]]);}
  else history.push({speaker:r[4],text:r[5]});
 }
 function next(){if(mode!=='story'||$('next').hidden||$('modal').open)return;window.GameAudio?.click();const r=rows[current];if(current==='OBS-10')state.seen=true;go(r[10]);}
 $('startBtn').onclick=()=>{window.GameAudio?.unlock();const begin=()=>{reset();street();};if(window.Opening)window.Opening.leave(begin);else begin();};$('next').onclick=next;$('line').onclick=next;$('enterBtn').onclick=()=>enter(places.find(p=>Math.abs(p.x-pos)<.045));
 const movement=(el,dir)=>{el.onpointerdown=e=>{if(mode!=='street')return;el.setPointerCapture(e.pointerId);target=null;held=dir;};el.onpointerup=el.onpointercancel=()=>held=0;};movement($('left'),-1);movement($('right'),1);
 document.addEventListener('keydown',e=>{if($('modal').open)return;if(['ArrowLeft','ArrowRight',' ','ArrowUp'].includes(e.key))e.preventDefault();if(mode==='street'){if(['a','A','ArrowLeft'].includes(e.key)){held=-1;target=null;}if(['d','D','ArrowRight'].includes(e.key)){held=1;target=null;}if((e.key==='e'||e.key==='E')&&!e.repeat)$('enterBtn').click();}else if(e.key===' '&&!e.repeat&&e.target.tagName!=='BUTTON')next();});document.addEventListener('keyup',e=>{if(['a','A','d','D','ArrowLeft','ArrowRight'].includes(e.key))held=0;});window.addEventListener('blur',()=>{held=0;target=null;window.GameAudio?.walk(false);});
 function frame(t){
  const dt=Math.min((t-lastTime)/1000,.05);lastTime=t;let moved=false;
  if(mode==='street'&&!$('modal').open&&!document.hidden){
   let dir=held;const before=pos;
   if(target!==null){if(Math.abs(target-pos)<.004){pos=target;target=null;}else dir=Math.sign(target-pos);}
   pos=Math.max(.035,Math.min(.97,pos+dir*dt*.15));moved=Math.abs(pos-before)>.000001;
   if(moved)$('walker').style.transform=`translateX(-50%) scaleX(${dir<0?-1:1})`;
   if(moved)position();
  }
  $('walker').classList.toggle('walking',moved);window.GameAudio?.walk(moved);
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);window.addEventListener('resize',position);
 function modal(title,body){held=0;target=null;window.GameAudio?.walk(false);$('modalTitle').textContent=title;$('modalBody').replaceChildren(body);$('modal').showModal();window.Opening?.syncVisibility();}$('closeModal').onclick=()=>$('modal').close();$('modal').addEventListener('close',()=>window.Opening?.syncVisibility());
 $('soundBtn').onclick=()=>{if(window.GameAudio)modal('声音设置',window.GameAudio.buildSettings());};
 $('journalBtn').onclick=()=>{let box=document.createElement('div');if(!history.length)box.textContent='故事还没有开始。';history.forEach(r=>{let div=document.createElement('div');div.className='record';let b=document.createElement('b');b.textContent=r.speaker;let p=document.createElement('p');p.textContent=r.text;div.append(b,p);box.append(div);});modal('走过的对话',box);};
 $('helpBtn').onclick=()=>{let box=document.createElement('div');box.innerHTML='<p>街道：按 A / D 或方向键行走，也可点击地点自动走过去。靠近后按 E 或点击“进入”。触屏可按住左右按钮移动。</p><p>对话：点击文字、“继续”或空格推进。出现选项时，点击你想作出的选择。</p><p>完整咨询至少一人后，可以回面包店作决定。也可以拜访其他人，或重看已经听过的建议。</p><p>声音：右上角“声音设置”可分别调整背景音乐、按钮和脚步音效，或一键静音。</p><p>两种选择没有分数和对错评价。进度保留在本次页面中，刷新将重新开始。</p>';let b=document.createElement('button');b.className='danger';b.textContent='从头开始';b.onclick=()=>{$('modal').close();reset();street();};box.append(b);modal('操作帮助',box);};$('brand').onclick=e=>{e.preventDefault();$('helpBtn').click();};
})();
