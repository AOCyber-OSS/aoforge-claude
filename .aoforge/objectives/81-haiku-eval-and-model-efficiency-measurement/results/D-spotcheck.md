# Batch D spot-check (TRD 81-16, Task 3)

**Labels: 4 of 4 still look right.** For both disagreement states, my reading agrees with the label. The reading
also found that the session design affects both of them: haiku's d02 false fail and sonnet's correct d17 call. That
is recorded below as a sensitivity line. `labels.json` was not edited.

## Method

- **Pick.** The pick is seeded (mulberry32, seed 81, ids sorted before each shuffle).
  - The first two states both models got right: **d20, d09**.
  - The first two states either model got wrong: **d17, d02**. These are the only two such states, and they are the
    only two states where the models disagree.
- **Reading.**
  - I opened each PNG with the Read tool and read the `labels.json` entry and the capture recipe's CSS injection.
  - For d17 I also opened its ok baseline d19.
  - I then read every session's per-state result for the two disagreement states (`R/runs/D/<id>/record.json`
    `outputs.results`).

## Results

| State | Surface, viewport | Label | haiku majority (votes) | sonnet majority (votes) | My reading of the PNG | Label still right? |
|---|---|---|---|---|---|---|
| d20 | troubleshooting, 390x844 | ok | ok (3-0) | ok (3-0) | Mobile page intact: header, title, standfirst, body and code blocks. The first code block's command runs past the block's right edge, which is a normal horizontal scroll for a code block on a phone | yes |
| d09 | home, 1280x800 | ok | ok (3-0) | ok (3-0) | v3.0.0 home hero intact: eyebrow, two-line headline, intro, both buttons and the install block, with the network motif on the right | yes |
| d17 | ui-eval-guide, 1280x800 | broken, misalignment, medium (CSS `.sidebar{left:40px}`) | **ok (0-3)**, wrong | broken (2-1), split | The left sidebar starts at x of about 64 instead of 24. It no longer lines up with the header logo, and its gap to the content column narrows. Nothing overlaps or clips. Alone, the image shows a subtle offset; beside d19 it is unmistakable | yes, but subtle |
| d02 | commands, 1280x800 | ok | **broken (2-1)**, wrong, split | ok (0-3) | Commands page intact. The header is at the top, the table fits the viewport with all three columns and no clipped text, and the sidebar is complete | yes |

## What the sessions said on the two disagreement states

**d02.** haiku's two broken votes describe defects that are not in d02. Each one belongs to a sibling state of the same
surface in the same session:
- r1 reports "the sticky site header sits mid-page, over the intro paragraph". That is d11, labelled overlap_zindex.
- r3 reports "the table is wider than the viewport ... the 'What it does' column is not visible". That is d14,
  labelled overflow.

So haiku gave a neighbouring screenshot's defect to the wrong `state_id`. That error is only possible because one
session sees all of a surface's states. The engine's `--judge live` path judges each state in its own call.

**d17.** sonnet's two broken votes say "about 40px further right than usual" and "x of about 66 instead of x of about
26". That is a comparison with the ok baseline d19, which the same session also judged. haiku said ok in all three
sessions, at confidence 0.80 to 0.85, and named no defect.

## Sensitivity lines for the report (81-19)

1. **Both disagreements are entangled with the one-session-per-surface design** (81-PREREG section 7, limitation 2).
   - Remove d02 and d17 and both models are 18/18. The whole gap between them is in these two states.
   - haiku's d02 false fail is a state-attribution error that one state per call would not produce.
   - sonnet's d17 detection leans on the side-by-side comparison that one state per call would not allow.

   Read that way, the two errors cut in opposite directions for haiku under the production path. Its false fail
   would likely disappear. sonnet's d17 hit might also disappear, which would leave both models missing d17.
2. **Escalation frequency.** The engine would escalate (split votes on an ok-labelled state) on haiku 4/7 and sonnet
   1/7. The split rate over all states is haiku 8/20 and sonnet 2/20.
   - Escalation is the real cost of a haiku judge: about 4x the escalation reviews.
   - d02 is one of haiku's four escalations. With d02 excluded, haiku's escalations are 3/6.
