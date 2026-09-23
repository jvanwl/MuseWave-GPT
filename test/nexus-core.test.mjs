import test from "node:test";
import assert from "node:assert/strict";
import { createNexusCore } from "../src/nexus-core.mjs";

test("research is explicit about a missing model",()=>{
  const core=createNexusCore();const job=core.research({question:"Which customer problem should be tested?"});
  assert.equal(job.status,"blocked_model_required");assert.equal(core.snapshot().blockedResearch,1);
});
test("learning memory records outcomes and remains bounded",()=>{
  const core=createNexusCore();core.remember({content:"Users completed onboarding",outcome:true,tags:["product"]});
  assert.equal(core.snapshot().learningExamples,1);
});
test("self-improvement cannot reach approval without tests and evaluation",()=>{
  const core=createNexusCore(),bad=core.propose({title:"Change core",rationale:"Experiment",tests:[]});
  assert.equal(core.evaluate(bad.id,{tests:1,security:1,quality:1,regression:1}).status,"rejected_by_evaluation");
  assert.throws(()=>core.approve(bad.id));
  const good=core.propose({title:"Improve planner",rationale:"Measured improvement",tests:["npm test"]});
  assert.equal(core.evaluate(good.id,{tests:.95,security:.9,quality:.9,regression:.9}).status,"awaiting_owner_approval");
  assert.equal(core.approve(good.id).status,"approved_for_review_branch");
});
