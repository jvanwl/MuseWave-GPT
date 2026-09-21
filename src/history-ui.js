
  const historyEngine=createHistoryEngine(HISTORY_CATALOG);
  const SAVE_KEY="musewave-human-history-v4";
  let historyState=historyEngine.fresh("early"),historyMode="control",historyZoom=1,historyCenter=[540,240],historyNotice="Saved locally in this browser.",historyCanSave=true;
  try{const saved=localStorage.getItem(SAVE_KEY);if(saved)historyState=historyEngine.restore(JSON.parse(saved));}
  catch{historyNotice="Save unavailable or invalid. Playing in memory; the previous save has not been overwritten.";historyCanSave=false;}
  const el=id=>document.getElementById(id),num=n=>Math.round(n).toLocaleString("en"),project=p=>[(p.lon+180)*3,(90-p.lat)*3];
  const palette=["#c6a86b","#6ca7be","#c27e7e","#8caa70","#a797ca","#d4a379","#66b1a5","#c19fc2","#9aaaca","#c1b269"];
  const scenario=()=>HISTORY_CATALOG.scenarios.find(x=>x.id===historyState.scenario);
  const factionColor=id=>{const index=scenario().factions.findIndex(f=>f[0]===id);return index<0?"#9a9e9a":palette[index%palette.length]};
  const terrainColor={hill:"#ab9580",forest:"#688c72",plain:"#b4b071",river:"#66acb1",coast:"#87b4cc",desert:"#d0b280"};
  function node(tag,attrs={},text){
    const n=document.createElementNS("http://www.w3.org/2000/svg",tag);
    Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;return n;
  }
  function textRows(root,lines){root.replaceChildren(...lines.map(text=>{const p=document.createElement("div");p.textContent=text;return p}));}
  function option(value,label){const o=document.createElement("option");o.value=value;o.textContent=label;return o;}
  function saveHistory(){
    if(historyCanSave)try{localStorage.setItem(SAVE_KEY,JSON.stringify(historyState))}
    catch{historyNotice="Browser storage is blocked. This campaign will not survive closing the page.";historyCanSave=false;}
    el("history-save").textContent=historyNotice;
  }
  function setupFactions(){
    const sc=HISTORY_CATALOG.scenarios.find(x=>x.id===el("history-scenario").value);
    el("history-faction").replaceChildren(...sc.factions.map(f=>option(f[0],f[1])));
    el("history-setup-note").textContent=sc.note;
    el("history-confirm-box").hidden=true;
  }
  el("history-scenario").replaceChildren(...HISTORY_CATALOG.scenarios.map(sc=>option(sc.id,historyEngine.date(sc.year)+" · "+sc.name)));
  el("history-scenario").value=historyState.scenario;setupFactions();el("history-faction").value=historyState.player;
  el("history-scenario").onchange=setupFactions;
  el("history-start").onclick=()=>{el("history-confirm-box").hidden=false;el("history-confirm-note").textContent="Start "+el("history-scenario").selectedOptions[0].textContent+"? This replaces only your current historical campaign. Older fictional saves are kept."};
  el("history-cancel").onclick=()=>el("history-confirm-box").hidden=true;
  el("history-confirm").onclick=()=>{
    historyState=historyEngine.fresh(el("history-scenario").value,el("history-faction").value);
    historyCanSave=true;historyNotice="Saved locally in this browser.";historyZoom=1;historyCenter=[540,240];
    el("history-confirm-box").hidden=true;el("history-status").textContent="Historical campaign started. Select a center to issue orders.";renderHistory();
  };
  function drawEarth(){
    const s=historyState,svg=el("history-map");svg.replaceChildren();
    const width=1080/historyZoom,height=480/historyZoom;
    svg.setAttribute("viewBox",[Math.max(0,Math.min(1080-width,historyCenter[0]-width/2)),Math.max(0,Math.min(480-height,historyCenter[1]-height/2)),width,height].join(" "));
    svg.append(node("rect",{width:1080,height:540,fill:"#0f2531"}));
    for(let x=0;x<=1080;x+=90)svg.append(node("path",{d:"M"+x+" 0V540",stroke:"#5b8b9c","stroke-width":.5,opacity:.2}));
    for(let y=0;y<=540;y+=90)svg.append(node("path",{d:"M0 "+y+"H1080",stroke:"#5b8b9c","stroke-width":.5,opacity:.2}));
    const land=node("g",{"pointer-events":"none",fill:"#374d4c",stroke:"#70817b","stroke-width":.5});
    for(const d of EARTH_PATHS)land.append(node("path",{d}));svg.append(land);
    const source=s.regions[s.source],selected=s.regions[s.target]||source,linked=source?historyEngine.routes(s,source.id,s.player):[],supplied=historyEngine.supply(s,s.player);
    if(source)for(const link of linked){
      const a=project(source),b=project(s.regions[link.id]);
      if(Math.abs(a[0]-b[0])>540)continue;
      svg.append(node("path",{d:"M"+a.join(",")+"L"+b.join(","),stroke:link.sea?"#6abed5":"#d2c091","stroke-width":1,"stroke-dasharray":link.sea?"5 4":"2 3",opacity:.7,"pointer-events":"none"}));
    }
    for(const p of Object.values(s.regions)){
      const [x,y]=project(p),isSelected=p.id===selected?.id;
      let color=factionColor(p.owner);
      if(historyMode==="terrain")color=terrainColor[p.terrain];
      if(historyMode==="supply")color=p.owner===s.player?(supplied.has(p.id)?"#64c4a3":"#e98a75"):"#75848a";
      const group=node("g",{role:"button",tabindex:0,"aria-label":p.name+", "+s.nations[p.owner].name,"class":"history-center"});
      group.append(node("circle",{cx:x,cy:y,r:isSelected?9:6,fill:color,stroke:isSelected?"#fff2c7":"#10232c","stroke-width":isSelected?2:1}));
      group.append(node("circle",{cx:x,cy:y,r:11,fill:"transparent"}));
      group.append(node("title",{},p.name+" · "+s.nations[p.owner].name+" · "+p.army+" formations"));
      group.onclick=()=>selectCenter(p.id);group.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectCenter(p.id)}};
      svg.append(group);
      if(isSelected||historyZoom>=2.5){
        svg.append(node("text",{x:x+12,y:y-10,fill:"#f6edda","font-size":historyZoom>=2.5?6:11,"font-weight":700,"paint-order":"stroke",stroke:"#0f2531","stroke-width":2,"pointer-events":"none"},p.name));
      }
    }
    const legend=el("history-legend");legend.replaceChildren();
    const labels=historyMode==="terrain"?Object.entries(terrainColor):historyMode==="supply"?[["Supplied","#64c4a3"],["Isolated","#e98a75"],["Other factions","#75848a"]]:scenario().factions.map(f=>[f[1],factionColor(f[0])]).concat([["Other regional actors","#9a9e9a"]]);
    for(const [label,color] of labels){const item=document.createElement("span"),dot=document.createElement("i");dot.style.background=color;item.append(dot,document.createTextNode(label));legend.append(item);}
  }
  function selectCenter(id){
    const p=historyState.regions[id];if(p.owner===historyState.player){historyState.source=id;historyState.target=null}else historyState.target=id;
    if(historyZoom>1)historyCenter=project(p);renderHistory();
  }
  function renderHistory(){
    const s=historyState,n=s.nations[s.player],currentEra=HISTORY_CATALOG.eras[historyEngine.eraAt(s.year)],tech=HISTORY_CATALOG.eras[n.tech],b=historyEngine.budget(s,s.player),own=historyEngine.lands(s,s.player),source=s.regions[s.source],target=s.regions[s.target],selected=target||source;
    el("history-date").textContent=historyEngine.date(s.year);
    el("history-era-now").textContent=currentEra.name+" · Turn "+s.turn;
    el("history-active-scenario").textContent="Opening: "+historyEngine.date(scenario().year)+" · "+scenario().name+(s.turn>1?" · Alternate history":"");
    el("history-faction-name").textContent=n.name;el("history-government").textContent=n.government+(s.year!==scenario().year?" · founding system, not a historical forecast":"");
    el("history-treasury").textContent=num(n.gold);el("history-food").textContent=num(n.food);
    el("history-forces").textContent=num(own.reduce((v,p)=>v+p.army,0));el("history-balance").textContent=(b.income-b.upkeep>=0?"+":"")+num(b.income-b.upkeep);
    el("history-science").textContent=num(n.science);el("history-prosperity").textContent=num(n.prosperity)+"/600";
    el("history-budget").textContent="Per turn: "+b.income+" income − "+b.upkeep+" upkeep; "+b.harvest+" provisions − "+b.consumption+" consumption. Statistics are balanced game values, not historical census data.";
    el("history-tech").textContent=tech.unlock+" · "+tech.economy;
    el("history-units").textContent=tech.unit+" · technology "+(n.tech+1)+"/10";
    el("history-research").disabled=s.over||n.gold<60||n.tech>=historyEngine.eraAt(s.year)||n.researchTurn===s.turn;
    el("history-research-hint").textContent=n.tech===9?"All technology tiers unlocked.":n.tech>=historyEngine.eraAt(s.year)?"Next tier becomes available in "+historyEngine.date(HISTORY_CATALOG.eras[n.tech+1].start)+".":"Next: "+HISTORY_CATALOG.eras[n.tech+1].unlock+" · "+(40+n.tech*15)+" knowledge required; each investment adds 30.";
    el("history-tax").value=String(n.tax);el("history-tax").disabled=s.over;
    el("history-region-select").replaceChildren(...Object.values(s.regions).map(p=>option(p.id,p.name+" · "+s.nations[p.owner].name)));
    el("history-region-select").value=selected?.id||"";
    const lines=selected?[s.nations[selected.owner].name+" · "+selected.terrain,selected.army+" formations · morale "+Math.round(selected.morale)+"%","Infrastructure "+selected.economy+"/10 · defenses "+selected.fort+"/3","Stability "+Math.round(selected.stability)+"% · simulated inhabitants "+num(selected.people),
      selected.owner===s.player?(historyEngine.supply(s,s.player).has(selected.id)?"Supply connected":"Supply isolated"):"Diplomacy: "+historyEngine.relation(s,s.player,selected.owner)]:["No centers remain."];
    if(source&&target){const f=historyEngine.forecast(s,source,target);lines.push(f.reachable?"Battle outlook: "+(f.ratio>1.2?"attacker advantage":f.ratio<.85?"defender advantage":"closely matched"):"No unlocked direct route from "+source.name+".")}
    textRows(el("history-region-info"),lines);
    el("history-orders-source").textContent=source?"Orders from "+source.name+(source.acted?" · mobilization used":" · forces available"):"No friendly center";
    const blocked=s.over||!source||source.owner!==s.player;
    const canSupply=source&&historyEngine.supply(s,s.player).has(source.id);
    el("history-recruit").disabled=blocked||source.acted||n.gold<35||n.food<12||source.people<800||!canSupply;
    el("history-develop").disabled=blocked||n.gold<60||source.economy>=10;
    el("history-fortify").disabled=blocked||n.tech<1||n.gold<55||source.fort>=3;
    el("history-relief").disabled=blocked||n.gold<25||n.food<15;
    const links=source?historyEngine.routes(s,source.id,s.player):[];
    const move=el("history-move-target");move.replaceChildren(...links.filter(l=>s.regions[l.id].owner===s.player).map(l=>option(l.id,s.regions[l.id].name+(l.sea?" · sea":""))));
    el("history-move").disabled=blocked||source.acted||source.army<2||!move.options.length;
    const war=target&&historyEngine.relation(s,s.player,target.owner)==="war",pair=target?[s.player,target.owner].sort().join(":"):"";
    el("history-attack").disabled=blocked||!war||!links.some(l=>l.id===target?.id)||source.acted||source.army<2;
    el("history-war").disabled=s.over||!target||war||(s.truces[pair]||0)>s.turn;
    el("history-peace").disabled=s.over||!war||n.gold<40;
    el("history-trade").disabled=s.over||!target||war||!!s.treaties[pair]||n.gold<30;
    el("history-end-turn").disabled=s.over;
    el("history-end-turn").textContent=s.over?"Campaign complete":"Advance to "+historyEngine.date(historyEngine.advanceYear(s.year))+" →";
    el("history-result").hidden=!s.over;el("history-result").textContent=s.result;
    el("history-objective").textContent=own.length+"/27 centers for strategic victory · Or reach technology 10 and 600 prosperity through peace and development.";
    textRows(el("history-log"),s.log);
    el("history-context").textContent=scenario().note+" Continuous campaigns retain your founding factions instead of forcing historical rise and fall.";
    el("history-source-link").href=scenario().source;
    drawEarth();saveHistory();
  }
  function historicalOrder(type,args={}){
    const result=historyEngine.action(historyState,type,args);
    el("history-status").textContent=result.ok?"Order executed.":result.message;
    if(historyState.regions[historyState.target]?.owner===historyState.player)historyState.target=null;
    renderHistory();
  }
  for(const type of ["recruit","develop","fortify","relief","attack","war","peace","trade","research"])el("history-"+type).onclick=()=>historicalOrder(type);
  el("history-tax").onchange=e=>historicalOrder("tax",{value:Number(e.target.value)});
  el("history-move").onclick=()=>historicalOrder("move",{target:el("history-move-target").value});
  el("history-end-turn").onclick=()=>{historyEngine.nextTurn(historyState);el("history-status").textContent="Economies, supply and rival decisions resolved.";renderHistory()};
  el("history-region-select").onchange=e=>selectCenter(e.target.value);
  el("history-map-mode").onchange=e=>{historyMode=e.target.value;drawEarth()};
  el("history-zoom-in").onclick=()=>{historyZoom=Math.min(4,historyZoom+.5);historyCenter=project(historyState.regions[historyState.target||historyState.source]||{lon:0,lat:10});drawEarth()};
  el("history-zoom-out").onclick=()=>{historyZoom=Math.max(1,historyZoom-.5);drawEarth()};
  el("history-home").onclick=()=>{historyZoom=1;historyCenter=[540,240];drawEarth()};
  for(const [id,dx,dy] of [["west",-90,0],["east",90,0],["north",0,-60],["south",0,60]])el("history-pan-"+id).onclick=()=>{historyCenter=[Math.max(0,Math.min(1080,historyCenter[0]+dx/historyZoom)),Math.max(0,Math.min(480,historyCenter[1]+dy/historyZoom))];drawEarth()};
  renderHistory();
