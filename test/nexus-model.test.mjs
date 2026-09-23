import test from "node:test";
import assert from "node:assert/strict";
import { NexusModel } from "../src/nexus-model.mjs";

test("embedded NEXUS model learns objective categories without an external API",()=>{
  const model=new NexusModel().seed();
  assert.equal(model.predict("repair a broken server error").label,"repair");
  assert.equal(model.predict("research evidence and sources").label,"research");
  const before=model.predict("sell subscriptions to customers").probabilities.revenue;
  for(let i=0;i<12;i++)model.learn("sell subscriptions to customers","revenue");
  assert.ok(model.predict("sell subscriptions to customers").probabilities.revenue>before);
});
test("model snapshots restore learned parameters",()=>{const first=new NexusModel().seed();first.learn("invent widgets","builder");const second=new NexusModel(first.snapshot());assert.deepEqual(second.predict("invent widgets"),first.predict("invent widgets"))});
