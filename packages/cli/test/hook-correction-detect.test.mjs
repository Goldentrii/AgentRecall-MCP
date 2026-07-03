// packages/cli/test/hook-correction-detect.test.mjs
//
// C1 capture-density fix tests.
//
// ROOT CAUSE 1: The behavioral-AND-correction gate was too strict.
//   Durable rules stated once as absolute commands (e.g. "this is not a website",
//   "there is no X — hallucination") have no frequency language, so BEHAVIORAL_SIGNALS
//   never fires. These are genuine durable corrections and should be captured.
//
// ROOT CAUSE 2: CORRECTION_PATTERNS missed indirect phrasing:
//   "actually did not", "there is no X", "hallucination", "please remember",
//   "this is not a website", "I don't want you to", "should have", etc.
//
// These tests run against the exported pattern-matching helpers in
// correction-detector.ts. They were written BEFORE the fix and will fail
// on the original code, proving the detector changes are load-bearing.
//
// C1 REVIEW REVISION (2026-07-03): single-gate invariant. Four patterns that
// originally appeared in BOTH gates (self-capturing) were narrowed:
//   - "please remember"      → BEHAVIORAL only (scheduling reminders don't capture)
//   - "hallucination"        → BEHAVIORAL only + accusatory frame required
//   - "i don't want you to"  → CORRECTION only (encouragement doesn't capture)
//   - "this is (not a|only)" → format-domain scoped (website/flyer/poster/...)
//
// Miss coverage tested: E11, E12, E22, E26, E28, E35, E47, E56 (8/11)
// E10 and E41 are intentional hard misses (no negation signal, autonomy grants).
// E57 is a documented narrowing casualty: "i don't want you to" is now
// CORRECTION-gate-only, so a bare one-off preference redirect with no
// independent durability signal no longer self-captures.
//
// FP guards:
//   - all 31 "no" events from m2-final.json must stay ≤ 2 false positives
//   - 13 adversarial daily-traffic cases (scheduling, research prose,
//     encouragement, scoping) must stay ≤ 2 false positives

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectCorrection } from "../dist/utils/correction-detector.js";

// Helper: assert prompt is captured (both gates fire)
function assertCaptures(text, label) {
  const r = detectCorrection(text);
  assert.ok(
    r.captured,
    `Expected CAPTURED for ${label}:\n  corr=${r.correctionHit ?? "NONE"}\n  beh=${r.behavioralHit ?? "NONE"}\n  text=${text.slice(0, 100)}`
  );
}

// Helper: assert prompt is NOT captured (at least one gate does not fire)
function assertSkips(text, label) {
  const r = detectCorrection(text);
  assert.ok(
    !r.captured,
    `Expected SKIP for ${label}:\n  corr=${r.correctionHit}\n  beh=${r.behavioralHit}\n  text=${text.slice(0, 100)}`
  );
}

// ── MISS EVENTS: must now be captured ────────────────────────────────────────

describe("hook-correction detector — miss events now captured", () => {
  it("E11: hallucination callout captures (there is no X + hallucination)", () => {
    assertCaptures(
      `Actually there is no allow message dispatch. I think we did it last time. Is this hallucination because actually there's nothing like this in group two? And also in the system settings I didn't find anything like retry so I think maybe it is also the hallucination.`,
      "E11"
    );
  });

  it("E12: 'not really good' + 'need to learn more' captures", () => {
    assertCaptures(
      `not really good. maybe let's go back to the original design and you need to learn more, not every tiem i give you the feedback and you  change the result, this is actually something not really optimal for users. we need to at least one shoot something`,
      "E12"
    );
  });

  it("E22: 'should have flagged' + 'defaulting to sparse' captures", () => {
    assertCaptures(
      `You're right, and I hear the frustration — let me own it. My earlier restraint came straight from the original written brief, which literally demanded a "poster contract: one focal element per side, max 3 type sizes, protect 40-50% empty purple field." That's a hook piece. What you're describing now is a different and equally valid goal: a capability showcase. I should have flagged that tension instead of defaulting to sparse. So let's redefine the target.`,
      "E22"
    );
  });

  it("E26: 'please remember' + 'this is not a website' captures", () => {
    assertCaptures(
      `Let's keep it like this but one bug is that "Contact us for free trial access". Please remember this is not a website. This is only in the flyer so nothing should be designed to be clickable or like a link. It's only showing things.`,
      "E26"
    );
  });

  it("E28: 'you actually did not apply' + 'for every page' captures", () => {
    assertCaptures(
      `And for the light and dark mode, you actually did not apply it to every page. You only did it for main pages. Do not do that. Please do it for every page and the API key should go to levada.com, not to any other place.`,
      "E28"
    );
  });

  it("E35: 'you didn't verify' + 'don't make mistakes' captures", () => {
    assertCaptures(
      `Just make sure everything in this file is right with no confusion. If there is something or a code you're unsure about or you didn't verify, maybe do not put them. It would be better if we don't make mistakes or cause confusions for our customers.`,
      "E35"
    );
  });

  it("E47: 'submit everything in 1 PR' + 'one project per PR' captures", () => {
    assertCaptures(
      `Okay, I think you submit everything in 1 PR, so that's why they provide me like that. Actually, can you maybe separate them, like one project per PR? It would be better for them to verify and to check and to approve.`,
      "E47"
    );
  });

  it("E56: 'code wrong' + 'everytime' captures", () => {
    assertCaptures(
      `also one thing, everytime i create new api key for claude in prismma and start claude in terminal, it is always opus 4 or other models rather than default 4.7. or 4.6.  can you please check if the pipleline or the interface or code wrong???`,
      "E56"
    );
  });

});

// ── HARD MISSES: inherently uncapturable by regex ─────────────────────────────

describe("hook-correction detector — intentional hard misses stay skipped", () => {
  it("E10: positive instruction without negation skips (bilingual Linear rule)", () => {
    assertSkips(
      `You should describe the problems in a very clear and specific way in English and Chinese and also the improvement plan should be very clear and specific.`,
      "E10 hard miss"
    );
  });

  it("E41: autonomy grant skips (no correction signal)", () => {
    assertSkips(
      `Yes, I think you can do phases without my permission because, after that, we can have a really thorough verification session after everything has been done, so you don't have to ask for my permission. Just make them done.`,
      "E41 hard miss"
    );
  });

  it("E57: bare 'I don't want you to open it' skips — narrowing casualty (correction gate fires, no independent durability signal)", () => {
    // C1-rev: "i don't want you to" is CORRECTION-only. Without a behavioral
    // partner this one-off preference redirect is (by design) not persisted.
    const r = detectCorrection(
      `I don't want you to open it. Can you use your tool or something to check whether it works in my system? Thank you. And when it works, we can go back to the right track.`
    );
    assert.equal(r.captured, false, "E57 must not self-capture after single-gate narrowing");
    assert.ok(r.correctionHit, "correction gate should still recognize the redirect");
    assert.equal(r.behavioralHit, null, "no durability signal is present in E57");
  });
});

// ── ORIGINAL PATTERNS: regression guard ──────────────────────────────────────

describe("hook-correction detector — original patterns still fire", () => {
  it("'that's wrong' still captures (with behavioral signal)", () => {
    assertCaptures("That's wrong, you always do this.", "original: that's wrong + always");
  });

  it("'you missed' still captures", () => {
    assertCaptures("You missed the main function. Every time I tell you this.", "original: you missed + every time");
  });

  it("不对 captures (Chinese correction)", () => {
    assertCaptures("这个不对，你每次都这样搞。", "original: 不对 + 每次");
  });
});

// ── FALSE POSITIVE GUARD: m2-final 31 "no" events ────────────────────────────

describe("hook-correction detector — false positive guard (≤2/31)", () => {
  const NO_EVENTS = [
    { id: "E02", text: `And besides the TPM what other indexes would be better if we can provide them to him? I mean we don't have to show him the very specific data. We can only show him the total token usage or TPM we have and also the different percentages for output, input, and other indexes so they can calculate with their AI. It's not necessary for us to give the real data to them. It's also about our data privacy.` },
    { id: "E03", text: `Okay we don't have to reply yet because the Excel and HTML are not as good as what I expected so I would say, what are your suggestions without cash?` },
    { id: "E05", text: `Ok I agree but we still need to recalculate the tokens that we use for real. Actually I told you before the Prisma data were real but it's only like one tenth or two tenths of what we used in total. If we calculate it back, what is the real use approximately? Can you calculate it?` },
    { id: "E07", text: `<task-notification><task-id>a70cacc3b5158055f</task-id><status>completed</status><summary>Agent "Recruiter perspective on portfolio" completed</summary></task-notification>` },
    { id: "E09", text: `Yes maybe do 416 at first and for this KYC maybe we do it later. And I just realized that we don't have model 417 here. Is it possible that you can fix it or could you find the root cause?` },
    { id: "E13", text: `Actually we add the connector but the plugins and the skill, I think, we didn't submit. SDKs are actually very important. So what's your plan now?` },
    { id: "E14", text: `Okay you can actually ship and also synchronize the MCP server. I don't know, like IP to one token. Can you tell me where I can get it? I saw the tier one. Just tell me what I need to do.` },
    { id: "E15", text: `Actually the key, I have already given you the key. You can still use that credential for our testing in order for CI. Yes then we can start. Just make sure everything is in the right direction. At least it should work.` },
    { id: "E16", text: `Okay if I said, "Could you redesign by yourself? Is it possible?" Because before I think we did website copy and we copied Novada. If you can still find it in our project folder, then maybe you can redesign this page as you want and then we can really get something different. Also for the overview page, is it possible for you?` },
    { id: "E18", text: `Actually I would say it's not overstating but the more the better. The more coverage will be the better and also the prompts. I didn't see the prompt and then maybe you can write a prompt here and then I can paste directly to cloud design for that.` },
    { id: "E19", text: `Actually, can you go back to check the folder? There is actually new curve code that I put inside, and also some additional design document that you can have a look at.` },
    { id: "E20", text: `内容不对` },
    { id: "E21", text: `所以我应该主动去投一些工作吗？还是说我工作也不投，就是等别人来找我吗？` },
    { id: "E23", text: `我平时的目的就是为了改善我的产品。你只要用了，就改善我的产品，而且这个是在远程的 GP，不是说咱们自己装的。咱们就不管，只要用远程的 GP，它用着用着就报错了。` },
    { id: "E24", text: `I didn't see any changes in Excel. Can you please tell me why the commitments are still here? We don't need commitments. The opportunities are still here. We don't need it because we need it to come from there. Workloads still vary in detail. I don't need very detailed. Maybe you need the wrong one or anything happened.` },
    { id: "E25", text: `One more feedback: the font should be bigger because we have actually a lot of spaces. We can make a bigger font with different styles and make it more beautiful.` },
    { id: "E27", text: `Okay then you may make this post talk thing as a high priority with a deadline of tomorrow. Then we talk about something very serious on the MCP website's design. It actually has a lot of bugs and the design is not like a website.` },
    { id: "E29", text: `Yes you can do it. You can also do it with plywood with different agents' group. We can actually fix them more with high quality because different agents have different suggestions and they can respond differently and do things differently.` },
    { id: "E30", text: `actually i can use 1 - 1.5b IN a day. that's why i am asking, you can be honest.` },
    { id: "E32", text: `有可能跟 Fable 5 上线有关，但更准确地说：不是 Fable 5 本身执行 Bash，而是 Claude Code 的 auto mode 安全分类器在背后要调用一个模型` },
    { id: "E33", text: `Actually can you run it for me? I ran it but it didn't work.` },
    { id: "E34", text: `Actually can we connect to this MCP so in future if we encounter any issue or anything fails, we can fix them immediately?` },
    { id: "E36", text: `Really impressive. Actually you can write it into Linear in a project of our MCP Host and Tools optimization. This is actually a really huge issue with high priority but we've done it.` },
    { id: "E37", text: `Okay, then this would be P0 for them, so I would like you to add them into HTML so I can send the HTML and I can tell them what happened and why we need it.` },
    { id: "E38", text: `file:///Users/tongwu/Projects/AgentRecall/warroom/install.html\nYes, this HTML is good, but I didn't see it in the first place. Actually, I would say maybe we can add another onboarding picture just in the quick start part.` },
    { id: "E40", text: `Okay, I'm going to review that these cards are not able to be clicked and navigated. Can you fix the issue? I tried to click the first loop and also final and your call, and it actually didn't work for me.` },
    { id: "E43", text: `Yes, really good. You're right, the diagnosis run text are trashed and miss route. I don't know what that is, but yeah, just okay. You build up with the trigger nice. Yeah, I think we can add them.` },
    { id: "E45", text: `Also, I want you to go to this website because you can see it has gateways: 1. Discover API 2. MCP` },
    { id: "E50", text: `Actually, there's one thing that I just thought is that the orchestration system, because we already have plywood, we already have you, right? As an orchestrator, the prompts are very important. Do you have any better idea?` },
    { id: "E53", text: `I think that is good if we create a key for them, but before creating the key, I think we need to know which model they would like to use, because now we only have Claude and OpenAI.` },
    { id: "E55", text: `Good, but the only thing is the font. I'm not very sure if it's a framework or it's a font. I don't recognize both. It looks a little bit weird.` },
  ];

  it("false-positive rate on 31 no-events stays ≤ 2", () => {
    const fps = NO_EVENTS.filter((ev) => detectCorrection(ev.text).captured);
    const fpIds = fps.map((ev) => ev.id).join(", ");
    assert.ok(
      fps.length <= 2,
      `FP count ${fps.length}/31 exceeds limit of 2. FP events: ${fpIds}`
    );
  });
});

// ── DAILY-TRAFFIC FP GUARD (C1 review 2026-07-03) ────────────────────────────
// Adversarial set targeting the four patterns that were originally dual-listed
// in both gates. Before the single-gate narrowing these measured 10/13 FP.
// Permanent guard: ≤ 2/13.

describe("hook-correction detector — daily-traffic FP guard (≤2/13)", () => {
  const DAILY_TRAFFIC = [
    // "please remember" — scheduling/reminders (was dual-listed, self-captured)
    { id: "D01", text: `Please remember standup moved to 9:30 tomorrow.` },
    { id: "D02", text: `Please remember the demo is on Friday — plan the sprint around it.` },
    { id: "D03", text: `Please remember to run the linter before committing.` },
    // "hallucination" — research/technical prose (frequent in this repo's own eval docs)
    { id: "D04", text: `The hallucination rate in the new eval dropped to 3 percent.` },
    { id: "D05", text: `Agent memory systems reduce hallucination by grounding responses in prior context.` },
    { id: "D06", text: `There's no hallucination in this output, it matched the source verbatim.` },
    // "I don't want you to" — encouragement/scoping (not corrections)
    { id: "D07", text: `I don't want you to rush; quality matters more than speed here.` },
    { id: "D08", text: `I don't want you to spend more than an hour on this investigation.` },
    { id: "D09", text: `I don't want you to worry about backwards compatibility yet.` },
    { id: "D10", text: `I don't want you to change the public API for this, keep the fix internal.` },
    // "this is (not a|only)" — hedging/framing (not format corrections)
    { id: "D11", text: `This is only a draft, we can polish the wording later.` },
    { id: "D12", text: `This is only a suggestion — your call on whether to adopt it.` },
    { id: "D13", text: `This is not a blocker, just flagging it for awareness.` },
  ];

  it("false-positive rate on 13 daily-traffic cases stays ≤ 2", () => {
    const fps = DAILY_TRAFFIC.filter((ev) => detectCorrection(ev.text).captured);
    const fpIds = fps
      .map((ev) => {
        const r = detectCorrection(ev.text);
        return `${ev.id}(corr=${r.correctionHit}, beh=${r.behavioralHit})`;
      })
      .join("; ");
    assert.ok(
      fps.length <= 2,
      `FP count ${fps.length}/13 exceeds limit of 2. FP cases: ${fpIds}`
    );
  });
});

// ── DETECTOR CONTRACT ────────────────────────────────────────────────────────

describe("hook-correction detector — contract", () => {
  it("short prompt (≤3 chars): captured=false but correctionHit still reported (hook-ambient feedback path)", () => {
    // hook-ambient uses the correction gate alone as a recall-feedback signal;
    // a bare "不对" reply must still register as a correction hit even though
    // it is too short to be captured as a durable rule.
    const r = detectCorrection("不对");
    assert.equal(r.captured, false, "bare 不对 must not be captured as a durable rule");
    assert.ok(r.correctionHit, "correction gate must still report the hit for feedback");
  });

  it("empty prompt: all-null result", () => {
    const r = detectCorrection("");
    assert.equal(r.captured, false);
    assert.equal(r.correctionHit, null);
    assert.equal(r.behavioralHit, null);
  });
});
