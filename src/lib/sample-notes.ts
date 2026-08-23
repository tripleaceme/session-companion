/**
 * Sample notes for the "After" phase, so the debrief half can be demoed without
 * having to sit through a talk first.
 *
 * Deliberately messy: fragments, arrows, a dangling "didn't get to" line. The
 * model is instructed to work only from what the notes actually say, and notes
 * this rough are the honest test of whether it does — polished input would let
 * a confabulating summary pass unnoticed.
 */
export const SAMPLE_NOTES = `- Opened with a live demo that failed on purpose. Typed 3 words into their own product, got a confident 4-paragraph answer that was mostly invented. Room went quiet.
- Core claim: "fluency is not calibration". The model's tone is constant regardless of how much it knows, so the *interface* has to carry the variance instead.
- Three patterns she kept coming back to:
    1. Render provenance, not confidence. Don't show 73%. Show WHICH input a sentence came from. Users can audit a source; they can't audit a number.
    2. Make the missing context an actionable UI element, not an error. Her example: instead of "insufficient information", the component renders a form asking for the exact field it lacked.
    3. Degrade the *component*, not just the copy. Speculative output gets different visual weight — dashed borders, lower contrast. You should be able to tell from six feet away.
- Strong opinion: confidence percentages INCREASE misplaced trust. Cited an internal study, didn't share numbers. Said precision implies measurement, and there was no measurement.
- Talked about the six-week removal of their summary feature. What brought it back was not a better model — it was showing which document each sentence came from.
- On React specifically: uncertainty should live in the data layer as a field on each item, never as component state. Otherwise you can't sort, filter, or test it.
- Didn't get to: evals. Said "that's a different talk" when someone asked how they measure whether the grounding tags are accurate.
- Q&A: someone asked about streaming. She said streaming makes this harder because you can't tag a claim you haven't finished generating. No clean answer.`;
