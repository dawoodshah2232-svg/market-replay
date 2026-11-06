// ReplayTrader — market replay + simulated trading. No server, no broker, no MT5 Manager.
const SYMBOLS = {
  XAUUSD:{label:'XAUUSD · Gold', digits:2, point:0.1, contract:100, file:'XAUUSD.json', source:'Yahoo GC=F (gold futures)'},
  BTCUSD:{label:'BTCUSD · Bitcoin', digits:1, point:1, contract:1, file:'BTCUSD.json', source:'Kraken'},
  ETHUSD:{label:'ETHUSD · Ethereum', digits:1, point:1, contract:1, file:'ETHUSD.json', source:'Kraken'},
  EURUSD:{label:'EURUSD', digits:5, point:0.0001, contract:100000, file:'EURUSD.json', source:'Yahoo'},
  GBPUSD:{label:'GBPUSD', digits:5, point:0.0001, contract:100000, file:'GBPUSD.json', source:'Yahoo'},
};
const SPEEDS=[4000,2000,1000,500,250,120,60];
const SPEED_LABELS=['1 candle / 4s','1 candle / 2s','1 candle / 1s','1 candle / 0.5s','1 candle / 0.25s','1 candle / 0.12s','1 candle / 0.06s'];
let symbol='XAUUSD', tf='H1', raw={}, candles=[], startIdx=0, curIdx=0, tickStep=0, playing=false, timer=null;
let balance=10000, startBalance=10000, spreadPts=2, tickMode=true, showSMA=false, zoom=80;
let positions=[], pending=[], history=[], peak=10000, challenge=null, mode='ago', agoVal=20;
let savedSessions=JSON.parse(localStorage.getItem('rt_sessions')||'[]');
const $=id=>document.getElementById(id);
const fmt=(n,d=2)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const spec=()=>SYMBOLS[symbol];
const priceFmt=p=>p.toFixed(spec().digits);
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2600)}
function agg(src,n){const out=[];for(let i=0;i<src.length;i+=n){const g=src.slice(i,i+n);if(!g.length)continue;out.push({t:g[0].t,o:g[0].o,h:Math.max(...g.map(c=>c.h)),l:Math.min(...g.map(c=>c.l)),c:g[g.length-1].c})}return out}
function getTF(base,tf){if(tf==='M30')return agg(base.M15||[],2);if(tf==='H4')return agg(base.H1||[],4);if(tf==='W1')return agg(base.D1||[],5);return base[tf]||[]}
async function loadSymbol(){
  $('dataBadge').textContent='Loading '+symbol+'…';
  try{
    if(!raw[symbol]){const r=await fetch('data/'+spec().file); if(!r.ok) throw new Error('HTTP '+r.status); raw[symbol]=await r.json();}
    candles=getTF(raw[symbol].timeframes,tf);
    $('dataBadge').textContent='● Real data · '+spec().source+' · '+candles.length+' candles to '+new Date(candles[candles.length-1].t).toLocaleDateString('en-GB');
    // default session: last 20 candles ago, so user sees replay immediately
    startIdx=Math.max(0,candles.length-1-agoVal); curIdx=startIdx; tickStep=0;
    positions=[]; pending=[]; history=[]; peak=balance; challenge=null; $('challengeInfo').textContent='';
    updateStartInfo(); renderAll();
  }catch(e){ $('dataBadge').textContent='Data failed to load — check connection, bundled file missing'; }
}
function currentPrice(){
  if(!candles.length) return 0;
  const c=candles[curIdx];
  if(tickStep===0) return c.o;
  if(tickStep>=10||!tickMode) return c.c;
  // interpolate inside candle: o -> (l or h) -> (h or l) -> c, 10 steps
  const bull=c.c>=c.o, pts=bull?[c.o,c.l,c.h,c.c]:[c.o,c.h,c.l,c.c];
  const seg=Math.min(2,Math.floor(tickStep/4)); // 0-3,4-7,8-9 approx
  const f=(tickStep%4)/3; const a=pts[seg], b=pts[Math.min(3,seg+1)];
  // smoother: use tickStep/10 across 3 segments
  const pos=tickStep/10*3, s=Math.min(2,Math.floor(pos)), fr=pos-s;
  return pts[s]+(pts[s+1]-pts[s])*fr;
}
function spread(){return spreadPts*spec().point}
function bid(){return currentPrice()-spread()/2} function ask(){return currentPrice()+spread()/2}
function pnlOf(p,price){const dir=p.side==='buy'?1:-1;return (price-p.entry)*dir*spec().contract*p.lots}
function equity(){let e=balance;for(const p of positions)e+=pnlOf(p,p.side==='buy'?bid():ask());return e}
function setStart(){
  if(!candles.length)return;
  if(mode==='random'){startIdx=Math.floor(Math.random()*(candles.length-60))+10;}
  else if(mode==='date'){const v=$('dateInput').value; if(!v){toast('Pick a date first');return} const ts=new Date(v).getTime(); let i=candles.findIndex(c=>c.t>=ts); if(i<0)i=candles.length-30; startIdx=Math.max(0,i);}
  else {agoVal=Math.max(2,Math.min(500,parseInt($('agoInput').value)||20)); startIdx=Math.max(0,candles.length-1-agoVal);}
  curIdx=startIdx; tickStep=0; positions=[]; pending=[]; history=[]; peak=balance;
  pause(); updateStartInfo(); renderAll();
  toast('Start set — future hidden. Press Play ▶');
}
function updateStartInfo(){
  if(!candles.length)return;
  const s=candles[startIdx], last=candles[candles.length-1];
  $('startInfo').textContent='Start: '+new Date(s.t).toLocaleString('en-GB')+' · '+priceFmt(s.c)+' · '+(candles.length-1-startIdx)+' candles hidden after this point.';
  $('chartTitle').textContent=symbol+' · '+tf;
}
function pause(){playing=false;clearInterval(timer);timer=null;$('btnPlay').textContent='▶';$('replayTag').textContent='REPLAY PAUSED';$('replayTag').style.background='rgba(245,185,66,.16)'}
function play(){if(!candles.length)return; if(curIdx>=candles.length-1&&tickStep>=10){toast('End of data — Restart or pick a new start');return}
  playing=true;$('btnPlay').textContent='⏸';$('replayTag').textContent='● REPLAYING';$('replayTag').style.background='rgba(34,197,94,.2)';
  const ms=SPEEDS[parseInt($('speed').value)]/(tickMode?10:1);
  timer=setInterval(stepTick,ms);}
function stepTick(){
  if(tickMode){tickStep++; if(tickStep>10){tickStep=0;curIdx++;}}
  else curIdx++;
  if(curIdx>=candles.length){curIdx=candles.length-1;tickStep=10;pause();toast('End of available history');}
  checkTriggers(); renderAll();
  if(curIdx>=candles.length-1&&tickStep>=10) pause();
}
function checkTriggers(){
  const b=bid(), a=ask();
  // pending orders
  for(const o of [...pending]){
    const hit=(o.type==='buylimit'&&a<=o.price)||(o.type==='selllimit'&&b>=o.price)||(o.type==='buystop'&&a>=o.price)||(o.type==='sellstop'&&b<=o.price);
    if(hit){pending.splice(pending.indexOf(o),1);openPos(o.side,o.price,o.lots,o.sl,o.tp,'pending filled');toast(o.type+' filled @ '+priceFmt(o.price));}
  }
  for(const p of [...positions]){
    const px=p.side==='buy'?b:a, pl=pnlOf(p,px);
    if(p.sl&&((p.side==='buy'&&px<=p.sl)||(p.side==='sell'&&px>=p.sl))) closePos(p,'SL',px);
    else if(p.tp&&((p.side==='buy'&&px>=p.tp)||(p.side==='sell'&&px<=p.tp))) closePos(p,'TP',px);
  }
  const eq=equity(); peak=Math.max(peak,eq);
  if(challenge&&eq<=challenge.failAt){challenge=null;$('challengeInfo').textContent='❌ CHALLENGE FAILED — equity hit the 5% drawdown limit.';toast('Challenge failed');}
  if(challenge&&eq>=challenge.target){$('challengeInfo').textContent='✅ CHALLENGE PASSED — +10% target hit!';challenge=null;toast('Challenge passed! 🎉');}
}
function lotForRisk(){
  const rp=parseFloat($('riskPct').value); if(!rp) return parseFloat($('lot').value)||0.1;
  const slP=parseFloat($('slPts').value)||0; if(!slP) return parseFloat($('lot').value)||0.1;
  const risk$=balance*rp/100, perLot=slP*spec().point*spec().contract;
  return Math.max(0.01,Math.round(risk$/perLot*100)/100);
}
function openPos(side,price,lots,sl,tp,note){
  lots=lots||lotForRisk();
  const p={id:Date.now()+Math.random(),side,entry:price,lots,sl:sl||0,tp:tp||0,openTime:new Date(candles[curIdx].t).toLocaleString('en-GB'),note:note||''};
  positions.push(p); renderAll(); return p;
}
function buySell(side){
  if(!candles.length||curIdx<0){toast('Set a start point first');return}
  const price=side==='buy'?ask():bid();
  const slP=parseFloat($('slPts').value)||0, tpP=parseFloat($('tpPts').value)||0;
  const sl=slP?price+(side==='buy'?-1:1)*slP*spec().point:0;
  const tp=tpP?price+(side==='buy'?1:-1)*tpP*spec().point:0;
  const p=openPos(side,price,0,sl,tp);
  toast(side.toUpperCase()+' '+p.lots+' lot @ '+priceFmt(price)+(sl?' · SL '+priceFmt(sl):'')+(tp?' · TP '+priceFmt(tp):''));
}
function closePos(p,reason,price){
  price=price??(p.side==='buy'?bid():ask());
  const pl=pnlOf(p,price); balance+=pl;
  history.unshift({side:p.side,lots:p.lots,entry:p.entry,exit:price,pl,reason,open:p.openTime,close:new Date(candles[curIdx].t).toLocaleString('en-GB'),r:0});
  positions.splice(positions.indexOf(p),1); renderAll();
}

// ---- Chart ----
const cv=$('chart'), ctx=cv.getContext('2d');
function drawChart(){
  const dpr=window.devicePixelRatio||1, W=cv.clientWidth, H=cv.clientHeight;
  if(cv.width!==W*dpr){cv.width=W*dpr;cv.height=H*dpr}
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
  if(!candles.length)return;
  const vis=candles.slice(Math.max(0,curIdx-zoom+1),curIdx+1);
  const padR=62, padB=18, plotW=W-padR, plotH=H-padB;
  let hi=Math.max(...vis.map(c=>c.h)), lo=Math.min(...vis.map(c=>c.l));
  for(const p of positions){hi=Math.max(hi,p.entry,p.sl||0,p.tp||0);lo=Math.min(lo,p.entry,p.sl||99999,p.tp||99999)}
  const pad=(hi-lo)*0.08||1; hi+=pad; lo-=pad;
  const y=v=>((hi-v)/(hi-lo))*plotH, x=i=>(i+0.5)*(plotW/vis.length);
  ctx.strokeStyle='#1c2333';ctx.fillStyle='#8b94a7';ctx.font='11px sans-serif';ctx.lineWidth=1;
  for(let g=0;g<5;g++){const v=lo+(hi-lo)*g/4, yy=y(v);ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(plotW,yy);ctx.stroke();ctx.fillText(v.toFixed(spec().digits),plotW+6,yy+4)}
  const bw=Math.max(2,plotW/vis.length*0.62);
  vis.forEach((c0,i)=>{let c=c0;
    // forming candle: the last (current) candle only shows what the replay has revealed so far
    if(i===vis.length-1){const cp=currentPrice();c={o:c0.o,h:Math.max(c0.o,cp),l:Math.min(c0.o,cp),c:cp,t:c0.t}}
    const up=c.c>=c.o, col=up?'#22c55e':'#ef4444';ctx.strokeStyle=col;ctx.fillStyle=col;
    ctx.beginPath();ctx.moveTo(x(i),y(c.h));ctx.lineTo(x(i),y(c.l));ctx.stroke();
    ctx.fillRect(x(i)-bw/2,y(Math.max(c.o,c.c)),bw,Math.max(1,Math.abs(y(c.o)-y(c.c))));});
  // SMA
  if(showSMA){for(const per of [20,50]){ctx.strokeStyle=per===20?'#f5b942':'#3b82f6';ctx.beginPath();let started=false;
    vis.forEach((c,i)=>{const gi=Math.max(0,curIdx-zoom+1)+i; if(gi<per-1)return; const s=candles.slice(gi-per+1,gi+1).reduce((a,k)=>a+k.c,0)/per; const xx=x(i),yy=y(s); started?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);started=true});ctx.stroke();}}
  // time labels
  ctx.fillStyle='#8b94a7'; vis.forEach((c,i)=>{if(i%Math.ceil(vis.length/5)===0){const d=new Date(c.t);ctx.fillText(tf==='D1'||tf==='W1'?d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}):d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x(i)-20,H-4)}});
  // current price line + position lines
  const cp=currentPrice(); ctx.strokeStyle='rgba(232,236,243,.7)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(0,y(cp));ctx.lineTo(plotW,y(cp));ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#e8ecf3';ctx.fillRect(plotW,y(cp)-9,58,18);ctx.fillStyle='#111';ctx.fillText(priceFmt(cp),plotW+4,y(cp)+4);
  for(const p of positions){
    const draw=(v,col,lab)=>{if(!v)return;ctx.strokeStyle=col;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(0,y(v));ctx.lineTo(plotW,y(v));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=col;ctx.fillText(lab+' '+priceFmt(v),6,y(v)-4)};
    draw(p.entry,p.side==='buy'?'#22c55e':'#ef4444',p.side.toUpperCase()+' '+p.lots);
    draw(p.sl,'#ef4444','SL'); draw(p.tp,'#22c55e','TP');
  }
  for(const o of pending){ctx.strokeStyle='#f5b942';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(0,y(o.price));ctx.lineTo(plotW,y(o.price));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#f5b942';ctx.fillText(o.type.toUpperCase()+' '+priceFmt(o.price),6,y(o.price)-4)}
  const c=candles[curIdx]; const cp2=currentPrice();
  const fh=Math.max(c.o,cp2), fl=Math.min(c.o,cp2);
  $('ohlc').innerHTML='O <b>'+priceFmt(c.o)+'</b> &nbsp; H <b>'+priceFmt(fh)+'</b> &nbsp; L <b>'+priceFmt(fl)+'</b> &nbsp; C <b>'+priceFmt(cp2)+'</b> &nbsp; <span class="'+(cp2>=c.o?'up':'down')+'">'+(cp2>=c.o?'▲':'▼')+' '+((cp2-c.o)/spec().point).toFixed(0)+' pts</span>';
  $('priceTag').textContent=priceFmt(cp); $('priceTag').style.color=c.c>=c.o?'#22c55e':'#ef4444';
  $('chartDate').textContent=new Date(c.t).toLocaleString('en-GB')+' · candle '+(curIdx+1)+' of '+candles.length;
  const total=candles.length-1-startIdx, done=Math.max(0,curIdx-startIdx);
  $('progBar').style.width=(total?done/total*100:0)+'%';
  $('sessionInfo').textContent=playing?'Replaying… '+done+' / '+total+' candles played':(done+' / '+total+' candles played · '+(total-done)+' still hidden');
}
// ---- Panels ----
function renderPositions(){
  const el=$('positions');
  if(!positions.length&&!pending.length){el.innerHTML='<p class="mut">No open positions. Press BUY or SELL during replay.</p>';return}
  el.innerHTML=pending.map(o=>'<div class="pos"><div class="r"><b>'+o.type.toUpperCase()+'</b><span>@ '+priceFmt(o.price)+' · '+o.lots+' lot</span><button class="chip" onclick="cancelPend('+o.id+')">Cancel</button></div></div>').join('')
  +positions.map(p=>{const px=p.side==='buy'?bid():ask(), pl=pnlOf(p,px);
    return '<div class="pos"><div class="r"><b class="'+(p.side==='buy'?'up':'down')+'">'+p.side.toUpperCase()+' '+p.lots+' lot</b><b class="'+(pl>=0?'up':'down')+'">'+(pl>=0?'+':'')+'$'+fmt(pl)+'</b></div>'
    +'<div class="r"><span>Entry '+priceFmt(p.entry)+'</span><span>Now '+priceFmt(px)+'</span></div>'
    +'<div class="r"><span>SL '+(p.sl?priceFmt(p.sl):'—')+'</span><span>TP '+(p.tp?priceFmt(p.tp):'—')+'</span></div>'
    +'<div class="r"><button class="chip" onclick="closeById('+p.id+')">Close</button><button class="chip" onclick="beById('+p.id+')">Breakeven</button><span class="mut">'+p.openTime+'</span></div></div>'}).join('');
}
window.closeById=id=>{const p=positions.find(x=>x.id===id);if(p)closePos(p,'Manual')};
window.beById=id=>{const p=positions.find(x=>x.id===id);if(p){p.sl=p.entry;renderAll();toast('SL moved to breakeven')}};
window.cancelPend=id=>{pending=pending.filter(x=>x.id!==id);renderAll()};
function renderStats(){
  const eq=equity(), fl=eq-balance;
  $('stBal').textContent='$'+fmt(balance); $('stEq').textContent='$'+fmt(eq);
  $('stFloat').textContent=(fl>=0?'+':'')+'$'+fmt(fl); $('stFloat').style.color=fl>=0?'#22c55e':'#ef4444';
  $('equityLine').textContent='Balance $'+fmt(balance)+' · Equity $'+fmt(eq);
  const wins=history.filter(h=>h.pl>0), losses=history.filter(h=>h.pl<0);
  const gw=wins.reduce((a,h)=>a+h.pl,0), gl=Math.abs(losses.reduce((a,h)=>a+h.pl,0));
  $('stTrades').textContent=history.length;
  $('stWin').textContent=history.length?Math.round(wins.length/history.length*100)+'%':'—';
  $('stPF').textContent=gl? (gw/gl).toFixed(2):(gw?'∞':'—');
  const tot=history.reduce((a,h)=>a+h.pl,0);
  $('stPL').textContent=(tot>=0?'+':'')+'$'+fmt(tot); $('stPL').style.color=tot>=0?'#22c55e':'#ef4444';
  const dd=peak? (peak-eq)/peak*100:0; $('stDD').textContent='-$'+fmt(peak-Math.min(peak,eq))+' ('+dd.toFixed(1)+'%)';
  $('stExp').textContent=history.length?'$'+fmt(tot/history.length):'—';
  $('history').innerHTML=history.length?'<table><tr><th>Trade</th><th>Entry</th><th>Exit</th><th>Reason</th><th>P/L</th></tr>'+history.map(h=>'<tr><td>'+h.side.toUpperCase()+' '+h.lots+'</td><td>'+priceFmt(h.entry)+'</td><td>'+priceFmt(h.exit)+'</td><td>'+h.reason+'</td><td class="'+(h.pl>=0?'up':'down')+'">'+(h.pl>=0?'+':'')+'$'+fmt(h.pl)+'</td></tr>').join('')+'</table>':'<p class="mut">No closed trades yet in this session.</p>';
}
function renderAll(){drawChart();renderPositions();renderStats();
  $('rrInfo').textContent='SL '+($('slPts').value||0)+' · TP '+($('tpPts').value||0)+' pts · lot (risk-sized) '+lotForRisk().toFixed(2);
}
// ---- Events ----
$('symbol').innerHTML=Object.entries(SYMBOLS).map(([k,v])=>'<option value="'+k+'">'+v.label+'</option>').join('');
$('symbol').onchange=e=>{symbol=e.target.value;raw[symbol]=raw[symbol];loadSymbol()};
$('tf').onchange=e=>{tf=e.target.value;loadSymbol()};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('on'));b.classList.add('on');mode=b.dataset.mode;$('modeAgo').classList.toggle('hidden',mode!=='ago');$('modeDate').classList.toggle('hidden',mode!=='date');$('modeRandom').classList.toggle('hidden',mode!=='random');if(mode==='random')setStart();});
document.querySelectorAll('[data-ago]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-ago]').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('agoInput').value=b.dataset.ago;agoVal=parseInt(b.dataset.ago);setStart();});
$('btnSetStart').onclick=setStart;
$('btnReveal').onclick=()=>{pause();curIdx=candles.length-1;tickStep=10;renderAll();toast('All candles revealed')};
$('btnPlay').onclick=()=>playing?pause():play();
$('btnStep').onclick=()=>{pause();tickStep=0;curIdx=Math.min(candles.length-1,curIdx+1);checkTriggers();renderAll()};
$('btnStepBack').onclick=()=>{pause();curIdx=Math.max(startIdx,curIdx-1);tickStep=0;renderAll()};
$('btnBack').onclick=()=>{pause();curIdx=startIdx;tickStep=0;renderAll()};
$('btnEnd').onclick=()=>{pause();curIdx=candles.length-1;tickStep=10;renderAll()};
$('btnRestart').onclick=()=>{pause();curIdx=startIdx;tickStep=0;positions=[];pending=[];history=[];balance=startBalance;peak=balance;renderAll()};
$('speed').oninput=e=>{$('speedLabel').textContent=SPEED_LABELS[parseInt(e.target.value)];if(playing){pause();play()}};
$('speedLabel').textContent=SPEED_LABELS[2];
$('btnTick').onclick=()=>{tickMode=!tickMode;$('tickLabel').textContent=tickMode?'ON — smooth':'OFF — candle jumps';toast(tickMode?'Tick mode on':'Tick mode off')};
$('btnZoomIn').onclick=()=>{zoom=Math.max(20,zoom-20);renderAll()};
$('btnZoomOut').onclick=()=>{zoom=Math.min(200,zoom+20);renderAll()};
$('btnSMA').onclick=e=>{showSMA=!showSMA;e.target.style.background=showSMA?'#f5b942':'';e.target.style.color=showSMA?'#111':'';renderAll()};
$('btnBuy').onclick=()=>buySell('buy'); $('btnSell').onclick=()=>buySell('sell');
$('lotMinus').onclick=()=>{$('lot').value=Math.max(0.01,((parseFloat($('lot').value)||0.1)-0.01)).toFixed(2)};
$('lotPlus').onclick=()=>{$('lot').value=((parseFloat($('lot').value)||0.1)+0.01).toFixed(2)};
document.querySelectorAll('[data-rr]').forEach(b=>b.onclick=()=>{const r=parseFloat(b.dataset.rr);const sl=parseFloat($('slPts').value)||50;$('tpPts').value=Math.round(sl*r);renderAll()});
$('btnPend').onclick=()=>{
  const t=$('pendType').value, px=parseFloat($('pendPrice').value);
  if(!t||!px){toast('Choose a pending type and a trigger price');return}
  const side=t.startsWith('buy')?'buy':'sell';
  pending.push({id:Date.now(),type:t,price:px,side,lots:lotForRisk(),sl:0,tp:0});
  toast(t+' placed @ '+priceFmt(px)); renderAll();
};
$('btnCloseAll').onclick=()=>{[...positions].forEach(p=>closePos(p,'Manual'));toast('All closed')};
$('btnBE').onclick=()=>{positions.forEach(p=>p.sl=p.entry);renderAll();toast('All SL → breakeven')};
$('btnSettings').onclick=()=>{const c=$('settingsCard');c.hidden=!c.hidden;c.scrollIntoView({behavior:'smooth'})};
$('btnApplySettings').onclick=()=>{startBalance=parseFloat($('startBal').value)||10000;balance=startBalance;peak=balance;spreadPts=parseFloat($('spreadPts').value)||0;positions=[];pending=[];history=[];renderAll();toast('Settings applied — account reset to $'+fmt(balance))};
$('btnCSV').onclick=()=>{
  if(!history.length){toast('No trades to export');return}
  const csv='side,lots,entry,exit,pl,reason,open,close\n'+history.map(h=>[h.side,h.lots,h.entry,h.exit,h.pl.toFixed(2),h.reason,'"'+h.open+'"','"'+h.close+'"'].join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='replaytrader-'+symbol+'-'+tf+'.csv';a.click();
};
$('btnSave').onclick=()=>{savedSessions.unshift({date:new Date().toISOString(),symbol,tf,start:new Date(candles[startIdx].t).toISOString(),balance,history,journal:$('journal').value});localStorage.setItem('rt_sessions',JSON.stringify(savedSessions.slice(0,20)));toast('Session saved ('+savedSessions.length+' saved)')};
$('btnLoad').onclick=()=>{if(!savedSessions.length){toast('No saved sessions yet');return}const s=savedSessions[0];alert('Latest saved session:\n'+s.symbol+' '+s.tf+' · start '+s.start+'\nBalance $'+fmt(s.balance)+' · '+s.history.length+' trades\nNote: '+ (s.journal||'—')+'\n\nFull list is in localStorage — this build restores the latest summary; replay the same start from the date picker to redo it.')};
$('btnJournal').onclick=()=>{toast('Note saved with this session — use Save session to keep it')};
$('btnChallenge').onclick=()=>{challenge={target:startBalance*1.10,failAt:startBalance*0.95};$('challengeInfo').textContent='🏁 Challenge live — PASS at $'+fmt(challenge.target)+' · FAIL below $'+fmt(challenge.failAt)+' equity.';toast('Challenge started')};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('on'));b.classList.add('on');['hist','journal','challenge'].forEach(t=>$('tab-'+t).classList.toggle('hidden',t!==b.dataset.tab))});
// touch crosshair: drag on chart to inspect a candle
let touching=false;
cv.addEventListener('pointerdown',e=>{touching=true;inspect(e)});
cv.addEventListener('pointermove',e=>{if(touching)inspect(e)});
cv.addEventListener('pointerup',()=>{touching=false;renderAll()});
function inspect(e){const r=cv.getBoundingClientRect(), plotW=r.width-62, visN=Math.min(zoom,curIdx+1);
  const i=Math.floor((e.clientX-r.left)/plotW*visN); const gi=Math.max(0,curIdx-visN+1)+i; if(gi<0||gi>curIdx)return;
  const c=candles[gi]; $('ohlc').innerHTML='O <b>'+priceFmt(c.o)+'</b> H <b>'+priceFmt(c.h)+'</b> L <b>'+priceFmt(c.l)+'</b> C <b>'+priceFmt(c.c)+'</b> · '+new Date(c.t).toLocaleString('en-GB');}
window.addEventListener('resize',()=>drawChart());
loadSymbol();
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{})}
