import { randomUUID } from "node:crypto";

const LIMITS={memories:500,researchJobs:100,proposals:50};
const now=()=>new Date().toISOString();

export function createNexusCore({providerReady=()=>false}={}){
  const state={memories:[],researchJobs:[],proposals:[],cycles:0,lastCycle:null};
  const bounded=(name,item)=>{state[name].unshift(item);state[name]=state[name].slice(0,LIMITS[name]);return item};
  function remember({content,source="owner",outcome=null,tags=[]}){
    if(typeof content!=="string"||content.trim().length<2)throw Error("Memory content is required");
    return bounded("memories",{id:randomUUID(),content:content.trim().slice(0,6000),source:String(source).slice(0,80),outcome:outcome===null?null:Boolean(outcome),tags:tags.map(String).slice(0,10),createdAt:now()});
  }
  function research({question,objective="",sources=[]}){
    if(typeof question!=="string"||question.trim().length<3)throw Error("Research question is required");
    return bounded("researchJobs",{id:randomUUID(),question:question.trim().slice(0,2000),objective:String(objective).slice(0,2000),sources:sources.map(String).slice(0,12),status:providerReady()?"queued":"blocked_model_required",findings:[],createdAt:now(),updatedAt:now()});
  }
  function propose({title,rationale,patch="",tests=[]}){
    if(!title||!rationale)throw Error("Proposal title and rationale are required");
    return bounded("proposals",{id:randomUUID(),title:String(title).slice(0,180),rationale:String(rationale).slice(0,4000),patch:String(patch).slice(0,100000),tests:tests.map(String).slice(0,20),status:"draft",scores:null,approved:false,createdAt:now(),updatedAt:now()});
  }
  function evaluate(id,scores){
    const p=state.proposals.find(x=>x.id===id);if(!p)throw Error("Proposal not found");
    const normalized={tests:Number(scores.tests)||0,security:Number(scores.security)||0,quality:Number(scores.quality)||0,regression:Number(scores.regression)||0};
    p.scores=normalized;p.status=Object.values(normalized).every(x=>x>=.8)&&p.tests.length?"awaiting_owner_approval":"rejected_by_evaluation";p.updatedAt=now();return p;
  }
  function approve(id){const p=state.proposals.find(x=>x.id===id);if(!p)throw Error("Proposal not found");if(p.status!=="awaiting_owner_approval")throw Error("Proposal has not passed evaluation");p.approved=true;p.status="approved_for_review_branch";p.updatedAt=now();return p}
  function cycle(){state.cycles++;state.lastCycle=now();return{cycle:state.cycles,providerReady:providerReady(),queuedResearch:state.researchJobs.filter(x=>x.status==="queued").length,blockedResearch:state.researchJobs.filter(x=>x.status.startsWith("blocked")).length,learningExamples:state.memories.filter(x=>x.outcome!==null).length,proposalsAwaitingApproval:state.proposals.filter(x=>x.status==="awaiting_owner_approval").length}}
  function snapshot(){return{cycle:state.cycles,lastCycle:state.lastCycle,providerReady:providerReady(),queuedResearch:state.researchJobs.filter(x=>x.status==="queued").length,blockedResearch:state.researchJobs.filter(x=>x.status.startsWith("blocked")).length,learningExamples:state.memories.filter(x=>x.outcome!==null).length,proposalsAwaitingApproval:state.proposals.filter(x=>x.status==="awaiting_owner_approval").length,memoryCount:state.memories.length,researchJobs:state.researchJobs.slice(0,20),proposals:state.proposals.slice(0,20),guardrails:{directProductionWrites:false,ownerApprovalRequired:true,minimumEvaluationScore:.8,rollbackRequired:true}}}
  return{remember,research,propose,evaluate,approve,cycle,snapshot};
}
