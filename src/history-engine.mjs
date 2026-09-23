export function createHistoryEngine(catalog) {
  const {regions,landRoutes,seaRoutes,eras,scenarios}=catalog;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const key=(a,b)=>[a,b].sort().join(":");
  const date=y=>y<0?Math.abs(y)+" BCE":y+" CE";
  const eraAt=y=>eras.reduce((n,e,i)=>y>=e.start?i:n,0);
  const lands=(s,id)=>Object.values(s.regions).filter(p=>p.owner===id);
  const pairRoutes=[...landRoutes.split(" ").map(link=>[...link.split("-"),0]),...seaRoutes];
  const routes=(s,id,owner=s.regions[id]?.owner)=>pairRoutes.filter(([a,b,min])=>(a===id||b===id)&&s.nations[owner]?.tech>=min).map(([a,b,min])=>({id:a===id?b:a,sea:min>0,min}));
  const relation=(s,a,b)=>a===b?"own":s.wars[key(a,b)]?"war":s.treaties[key(a,b)]?"trade":"peace";
  const defense={hill:1.35,forest:1.2,plain:1,coast:1.05,river:1.1,desert:1.15};
  function log(s,msg){s.log.unshift(date(s.year)+" · "+msg);s.log=s.log.slice(0,45)}
  function random(s){s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296}
  function fresh(scenarioId="early",playerId){
    const scenario=scenarios.find(x=>x.id===scenarioId);
    if(!scenario)throw Error("Unknown historical scenario.");
    const chosen=scenario.factions.find(f=>f[0]===playerId)||(!playerId?scenario.factions[0]:null);
    if(!chosen)throw Error("Choose a faction from this scenario.");
    const s={version:4,scenario:scenario.id,player:chosen[0],year:scenario.year,turn:1,seed:2026,regions:{},nations:{},wars:{},truces:{},treaties:{},source:chosen[3][0],target:null,over:false,result:"",log:[]};
    for(const [i,[id,name,lon,lat,terrain]] of regions.entries()){
      const owner="local_"+id;
      s.regions[id]={id,name,lon,lat,terrain,owner,economy:3+i%3,army:7+i%4,people:scenario.era===0?1200:30000+i*700,stability:80,morale:80,fort:0,acted:false};
      s.nations[owner]={name:name+" communities",government:"Autonomous regional actor (abstract)",capital:id,gold:150,food:180,tax:1,tech:scenario.era,science:0,weariness:0,prosperity:0,researchTurn:0};
    }
    for(const [id,name,government,owned] of scenario.factions){
      s.nations[id]={name,government,capital:owned[0],gold:220,food:250,tax:1,tech:scenario.era,science:0,weariness:0,prosperity:0,researchTurn:0};
      for(const place of owned){if(!s.regions[place])throw Error("Unknown scenario region");s.regions[place].owner=id;s.regions[place].army=16;s.regions[place].fort=scenario.era>1?1:0;}
    }
    log(s,"Historical opening: "+scenario.name+". All subsequent outcomes are alternate history.");
    return s;
  }
  function supply(s,owner){
    const own=lands(s,owner),home=own.find(p=>p.id===s.nations[owner].capital)||own[0];
    const reached=new Set(home?[home.id]:[]),queue=home?[home.id]:[];
    while(queue.length)for(const link of routes(s,queue.shift(),owner))if(s.regions[link.id].owner===owner&&!reached.has(link.id)){reached.add(link.id);queue.push(link.id)}
    return reached;
  }
  function contact(s,actor,other){
    const queue=lands(s,actor).map(p=>p.id),visited=new Set(queue);
    while(queue.length){const id=queue.shift();if(s.regions[id].owner===other)return true;
      for(const link of routes(s,id,actor))if(!visited.has(link.id)){visited.add(link.id);queue.push(link.id)}
    }
    return false;
  }
  function budget(s,owner){
    const n=s.nations[owner],own=lands(s,owner),connected=supply(s,owner);
    const tradePartners=Object.keys(s.treaties).filter(k=>k.split(":").includes(owner)&&k.split(":").every(id=>lands(s,id).length)).length;
    return {income:Math.floor(own.reduce((sum,p)=>sum+p.economy*(5+n.tech*.8)*n.tax*p.stability/100*(connected.has(p.id)?1:.5),0))+tradePartners*8,
      upkeep:Math.ceil(own.reduce((sum,p)=>sum+p.army*(.45+n.tech*.025)+p.fort*2,0)),
      harvest:Math.floor(own.reduce((sum,p)=>sum+p.economy*(p.terrain==="river"?8:p.terrain==="desert"?3:6)*(1+n.tech*.08),0)),
      consumption:Math.ceil(own.reduce((sum,p)=>sum+p.army*.6+4,0)),
      science:Math.max(1,Math.floor(own.reduce((sum,p)=>sum+p.economy,0)/3))};
  }
  function forecast(s,a,d){
    const n=s.nations[a.owner],enemy=s.nations[d.owner],supplied=supply(s,a.owner).has(a.id);
    const route=routes(s,a.id,a.owner).find(x=>x.id===d.id);
    const attack=Math.max(0,a.army-1)*(1+n.tech*.13)*a.morale/100*(supplied?1:.65)*(route?.sea?.8:1);
    const defend=d.army*(1+enemy.tech*.13)*d.morale/100*defense[d.terrain]*(1+d.fort*.25);
    return {attack,defend,ratio:attack/Math.max(1,defend),supplied,reachable:!!route};
  }
  function finish(s){
    if(!lands(s,s.player).length){s.over=true;s.result="Defeat: your faction has lost its strategic centers."}
    else if(lands(s,s.player).length>=Math.ceil(regions.length*.6)){s.over=true;s.result="Strategic victory: control of 60% of the modeled centers."}
    else if(s.nations[s.player].tech===9&&s.nations[s.player].prosperity>=600){s.over=true;s.result="Development victory: advanced knowledge and sustained prosperity."}
  }
  function action(s,type,args={},actor=s.player){
    const fail=message=>({ok:false,message});
    if(s.over)return fail("This campaign has ended.");
    const n=s.nations[actor],p=s.regions[args.source||s.source],d=s.regions[args.target||s.target];
    if(!n||!lands(s,actor).length)return fail("No active faction.");
    if(type==="tax"){
      if(![.75,1,1.35].includes(Number(args.value)))return fail("Invalid tax policy.");
      n.tax=Number(args.value);return {ok:true};
    }
    if(type==="research"){
      if(n.tech>=eraAt(s.year))return fail("Next technology is not available in this era.");
      if(n.researchTurn===s.turn)return fail("Research investment already made this turn.");
      if(n.gold<60)return fail("Research requires 60 treasury.");
      n.gold-=60;n.science+=30;n.researchTurn=s.turn;
      const cost=40+n.tech*15;
      if(n.science>=cost){n.science-=cost;n.tech++;log(s,n.name+" adopted "+eras[n.tech].unlock+".")}
      finish(s);return {ok:true};
    }
    if(["war","peace","trade","envoy"].includes(type)){
      if(!d||d.owner===actor)return fail("Select another faction.");
      if(type!=="peace"&&!contact(s,actor,d.owner))return fail("No contact route. Research navigation before transoceanic diplomacy.");
      const k=key(actor,d.owner);
      if(type==="war"){
        if(s.wars[k])return fail("Already at war.");
        if((s.truces[k]||0)>s.turn)return fail("An armistice is still in force.");
        s.wars[k]=true;delete s.treaties[k];n.weariness=clamp(n.weariness+8,0,90);
        log(s,n.name+" declared war on "+s.nations[d.owner].name+".");
      }else if(type==="peace"){
        if(!s.wars[k])return fail("There is no war to settle.");
        if(n.gold<40)return fail("An armistice costs 40 treasury.");
        n.gold-=40;delete s.wars[k];s.truces[k]=s.turn+5;log(s,"Five-turn armistice: "+n.name+" / "+s.nations[d.owner].name+".");
      }else if(type==="trade"){
        if(s.wars[k]||s.treaties[k])return fail("Trade requires peace and no existing pact.");
        if(n.gold<30)return fail("A trade pact costs 30 treasury.");
        n.gold-=30;s.treaties[k]=true;log(s,"Trade agreement: "+n.name+" / "+s.nations[d.owner].name+".");
      }else{
        if(n.gold<15)return fail("A diplomatic mission requires 15 treasury.");
        n.gold-=15;n.weariness=clamp(n.weariness-8,0,90);lands(s,d.owner).forEach(p=>p.stability=clamp(p.stability+2,0,100));
        log(s,n.name+" opened a diplomatic channel with "+s.nations[d.owner].name+".");
      }
      return {ok:true};
    }
    if(!p||p.owner!==actor)return fail("Select one of your own centers first.");
    if(type==="recruit"){
      if(p.acted)return fail("This center has already mobilized this turn.");
      if(n.gold<35||n.food<12||p.people<800)return fail("Requires 35 treasury, 12 provisions and 800 inhabitants.");
      if(!supply(s,actor).has(p.id))return fail("Restore a supply route first.");
      n.gold-=35;n.food-=12;p.people-=200;p.army+=4;p.acted=true;p.morale=clamp(p.morale-3,20,100);
      log(s,"Four "+eras[n.tech].unit.toLowerCase()+" recruited at "+p.name+".");
    }else if(type==="develop"){
      if(n.gold<60||p.economy>=10)return fail("Requires 60 treasury; infrastructure limit 10.");
      n.gold-=60;p.economy++;log(s,p.name+" expanded its "+eras[n.tech].economy.toLowerCase()+".");
    }else if(type==="fortify"){
      if(n.tech<1)return fail("Research organized construction first.");
      if(n.gold<55||p.fort>=3)return fail("Requires 55 treasury; fortification limit 3.");
      n.gold-=55;p.fort++;log(s,"Defenses strengthened at "+p.name+".");
    }else if(type==="relief"){
      if(n.gold<25||n.food<15)return fail("Requires 25 treasury and 15 provisions.");
      n.gold-=25;n.food-=15;p.stability=clamp(p.stability+15,0,100);p.morale=clamp(p.morale+8,20,100);
    }else if(type==="mine"){
      if(p.acted)return fail("This center has already mobilized this turn.");
      if(n.tech<2)return fail("Mining requires metalworking technology.");
      const yieldAmount=18+p.economy*4+(p.terrain==="hill"?18:p.terrain==="desert"?8:0);n.gold+=yieldAmount;p.stability=clamp(p.stability-5,0,100);p.acted=true;
      log(s,p.name+" extracted resources worth "+yieldAmount+" treasury; local stability fell by 5.");
    }else if(type==="repair"){
      if(n.gold<35)return fail("Repairs require 35 treasury.");
      if(p.fort>=3&&p.stability>=90)return fail("This center does not need repairs.");
      n.gold-=35;p.fort=clamp(p.fort+1,0,3);p.stability=clamp(p.stability+8,0,100);p.morale=clamp(p.morale+5,20,100);
      log(s,p.name+" repaired defenses and civic infrastructure.");
    }else if(type==="move"||type==="attack"){
      if(!d||!routes(s,p.id,actor).some(link=>link.id===d.id))return fail("No available route. Some sea routes require later technology.");
      if(p.acted||p.army<2)return fail("No uncommitted forces.");
      if(type==="move"){
        if(d.owner!==actor)return fail("Transfers require a friendly destination.");
        const amount=Math.max(1,Math.floor((p.army-1)/2));p.army-=amount;d.army+=amount;d.acted=true;p.acted=true;
        log(s,"Transferred "+amount+" formations to "+d.name+".");
      }else{
        if(d.owner===actor||!s.wars[key(actor,d.owner)])return fail("Declare war before attacking.");
        const f=forecast(s,p,d),a=p.army-1,old=d.army;
        const win=f.attack*(.9+random(s)*.2)>f.defend*(.9+random(s)*.2);
        p.acted=true;n.weariness=clamp(n.weariness+4,0,90);
        if(win){
          const loss=Math.min(a-1,Math.max(1,Math.ceil(old*.45*defense[d.terrain])));
          p.army=1;d.army=Math.max(1,a-loss);d.owner=actor;d.stability=35;d.morale=Math.max(40,p.morale-15);d.acted=true;d.fort=Math.max(0,d.fort-1);
          log(s,n.name+" took "+d.name+"; "+loss+" attacking formations lost.");
        }else{
          const loss=Math.min(p.army-1,Math.max(1,Math.ceil(a*.35)));p.army-=loss;d.army=Math.max(1,old-Math.ceil(old*.15));p.morale=clamp(p.morale-15,20,100);
          log(s,"Attack repelled at "+d.name+"; "+loss+" attacking formations lost.");
        }
        d.people=Math.max(400,Math.floor(d.people*.99));
      }
    }else return fail("Unknown order.");
    finish(s);return {ok:true};
  }
  function advanceYear(year){
    const i=eraAt(year),amount=eras[i].step;
    let next=year+amount;if(year<0&&next>=0)next++;
    if(eras[i+1])next=Math.min(next,eras[i+1].start);
    return Math.min(next,2025);
  }
  function nextTurn(s){
    if(s.over)return;
    for(const owner of Object.keys(s.nations)){
      const own=lands(s,owner);if(!own.length)continue;
      const n=s.nations[owner],b=budget(s,owner),connected=supply(s,owner);
      const insolvent=n.gold+b.income<b.upkeep,starving=n.food+b.harvest<b.consumption;
      n.gold=Math.max(0,n.gold+b.income-b.upkeep);n.food=Math.max(0,n.food+b.harvest-b.consumption);
      n.science=Math.min(2000,n.science+b.science);
      const atWar=Object.keys(s.wars).some(k=>k.split(":").includes(owner));
      n.weariness=clamp(n.weariness+(atWar?1:-4),0,90);
      if(!atWar&&!starving&&!insolvent)n.prosperity+=Math.floor(own.reduce((v,p)=>v+p.economy*p.stability/100,0));
      for(const p of own){
        const isolated=!connected.has(p.id);
        if(isolated||starving||insolvent){p.army=Math.max(1,p.army-Math.max(1,Math.ceil(p.army*.08)));p.morale=clamp(p.morale-10,20,100);if(owner===s.player)log(s,p.name+": attrition from "+(starving?"shortages":insolvent?"unpaid forces":"isolation")+".");}
        else p.morale=clamp(p.morale+5,20,100);
        p.stability=clamp(p.stability+(n.tax>1?-5:n.tax<1?4:2)-n.weariness*.04-(starving?12:0),0,100);
        p.people=Math.max(400,Math.round(p.people*(starving?.985:1.003)));p.acted=false;
        if(p.stability<20&&random(s)<.15){p.owner="local_"+p.id;p.stability=55;log(s,p.name+" declared local autonomy.");}
      }
    }
    s.turn++;const prior=eraAt(s.year);s.year=advanceYear(s.year);
    if(eraAt(s.year)!==prior)log(s,"Era transition: "+eras[eraAt(s.year)].name+". New research is available. Your alternate-history factions persist.");
    for(const owner of Object.keys(s.nations)){
      if(owner===s.player||s.over)continue;
      const own=lands(s,owner);if(!own.length)continue;
      const options=own.flatMap(p=>routes(s,p.id,owner).map(link=>({p,d:s.regions[link.id]}))).filter(({p,d})=>relation(s,owner,d.owner)==="war"&&forecast(s,p,d).ratio>1.2).sort((a,b)=>forecast(s,b.p,b.d).ratio-forecast(s,a.p,a.d).ratio);
      const atWar=Object.keys(s.wars).some(k=>k.split(":").includes(owner));
      if(options.length)action(s,"attack",{source:options[0].p.id,target:options[0].d.id},owner);
      else if(atWar)action(s,"recruit",{source:own.find(p=>supply(s,owner).has(p.id))?.id},owner);
      else if(s.nations[owner].tech<eraAt(s.year))action(s,"research",{},owner);
      else if(s.nations[owner].gold>130)action(s,"develop",{source:own.slice().sort((a,b)=>a.economy-b.economy)[0].id},owner);
      if(s.nations[owner].weariness>35){const enemy=Object.values(s.regions).find(p=>relation(s,owner,p.owner)==="war");if(enemy)action(s,"peace",{target:enemy.id},owner);}
    }
    finish(s);
    if(!s.over&&s.year>=2025){s.over=true;s.result="Timeline completed in 2025. Your alternate-history campaign has reached its endpoint.";}
    if(s.regions[s.source]?.owner!==s.player)s.source=lands(s,s.player)[0]?.id||null;
    s.target=null;
  }
  function restore(raw){
    if(!raw||raw.version!==4||!Number.isSafeInteger(raw.turn)||raw.turn<1||!Number.isSafeInteger(raw.year)||raw.year===0||raw.year>2025||!Number.isInteger(raw.seed))throw Error("Invalid historical save.");
    const s=fresh(raw.scenario,raw.player);
    if(raw.year<s.year||!raw.nations||!raw.regions||!raw.wars||!raw.truces||!raw.treaties)throw Error("Incomplete historical save.");
    const finite=(obj,fields)=>fields.every(k=>Number.isFinite(obj?.[k])&&obj[k]>=0&&obj[k]<=1e12);
    for(const [id,n] of Object.entries(s.nations)){
      const old=raw.nations[id];
      if(!finite(old,["gold","food","science","weariness","prosperity","researchTurn","tech"])||!Number.isInteger(old.tech)||old.tech>eraAt(raw.year)||![.75,1,1.35].includes(old.tax))throw Error("Invalid faction state.");
      for(const k of ["gold","food","science","weariness","prosperity","researchTurn","tech","tax"])n[k]=old[k];
    }
    for(const [id,p] of Object.entries(s.regions)){
      const old=raw.regions[id];if(!finite(old,["economy","army","people","stability","morale","fort"])||!Object.hasOwn(s.nations,old.owner)||old.army<1||old.economy<1||old.economy>10||old.fort>3||old.morale>100||old.stability>100)throw Error("Invalid region state.");
      for(const k of ["owner","economy","army","people","stability","morale","fort"])p[k]=old[k];p.acted=!!old.acted;
    }
    for(const [k,v] of Object.entries(raw.wars))if(v===true&&k.split(":").length===2&&k.split(":").every(id=>Object.hasOwn(s.nations,id)))s.wars[k]=true;
    for(const [k,v] of Object.entries(raw.treaties))if(v===true&&!s.wars[k]&&k.split(":").length===2&&k.split(":").every(id=>Object.hasOwn(s.nations,id)))s.treaties[k]=true;
    for(const [k,v] of Object.entries(raw.truces))if(Number.isSafeInteger(v)&&v>=0&&k.split(":").length===2&&k.split(":").every(id=>Object.hasOwn(s.nations,id)))s.truces[k]=v;
    s.turn=raw.turn;s.year=raw.year;s.seed=raw.seed>>>0;
    s.source=s.regions[raw.source]?.owner===s.player?raw.source:lands(s,s.player)[0]?.id||null;
    s.target=s.regions[raw.target]&&s.regions[raw.target].owner!==s.player?raw.target:null;
    s.log=Array.isArray(raw.log)?raw.log.filter(x=>typeof x==="string").map(x=>x.slice(0,350)).slice(0,45):[];
    finish(s);if(!s.over&&s.year===2025){s.over=true;s.result="Timeline completed in 2025. Your alternate-history campaign has reached its endpoint.";}
    return s;
  }
  return {fresh,restore,action,nextTurn,advanceYear,eraAt,date,lands,routes,supply,contact,budget,forecast,relation,defense};
}
