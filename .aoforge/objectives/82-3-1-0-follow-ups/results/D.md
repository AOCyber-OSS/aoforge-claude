# Batch D (objective 82) results

Scored at 2026-10-18T11:44:08.328Z. 20 states; planned 120 start sessions and 3 escalation sessions.

| Metric | Haiku start (P1) | Haiku (raw) | Sonnet start |
|---|---|---|---|
| accuracy | 19/20 (95.0%, 76.4%-99.1%) | 19/20 (95.0%, 76.4%-99.1%) | 18/20 (90.0%, 69.9%-97.2%) |
| broken_missed | 1/13 (7.7%, 1.4%-33.3%) | 1/13 (7.7%, 1.4%-33.3%) | 1/13 (7.7%, 1.4%-33.3%) |
| false_fail | 0/7 (0.0%, 0.0%-35.4%) | 0/7 (0.0%, 0.0%-35.4%) | 1/7 (14.3%, 2.6%-51.3%) |
| split rate | (haiku) | 2/20 (10.0%, 2.8%-30.1%) | 1/20 (5.0%, 0.9%-23.6%) |
| escalation rate | (haiku) | 1/20 (5.0%, 0.9%-23.6%) | 0/20 (0.0%, 0.0%-16.1%) |
| escalation rate, ok-labelled | (haiku) | 1/7 (14.3%, 2.6%-51.3%) | 0/7 (0.0%, 0.0%-35.4%) |

Incomplete: haiku 0 states, sonnet 0 states, haiku start 0 states.

Escalated states: haiku d02; sonnet none. Escalated-verdict agreement with the Sonnet start: 1/1 (100.0%, 20.7%-100.0%).

Cost: Haiku start $0.1334 (samples $0.0773 + escalations $0.0561); Sonnet start $1.1462 (samples $1.1462 + $0.0000, estimate: the sonnet arm escalated no state).

| State | Label | Haiku votes | Haiku outcome | Escalated | Escalation votes | Haiku-start final | Sonnet votes | Sonnet outcome |
|---|---|---|---|---|---|---|---|---|
| d01 | broken | 0 ok / 3 broken | fail | no | - | broken | 0 ok / 3 broken | fail |
| d02 | ok | 2 ok / 1 broken | review | yes | 3 ok / 0 broken | ok | 3 ok / 0 broken | pass |
| d03 | broken | 0 ok / 3 broken | pass | no | - | broken | 0 ok / 3 broken | pass |
| d04 | broken | 0 ok / 3 broken | pass | no | - | broken | 0 ok / 3 broken | pass |
| d05 | broken | 0 ok / 3 broken | fail | no | - | broken | 0 ok / 3 broken | fail |
| d06 | broken | 0 ok / 3 broken | fail | no | - | broken | 0 ok / 3 broken | fail |
| d07 | broken | 0 ok / 3 broken | fail | no | - | broken | 0 ok / 3 broken | fail |
| d08 | broken | 1 ok / 2 broken | pass | no | - | broken | 0 ok / 3 broken | pass |
| d09 | ok | 3 ok / 0 broken | pass | no | - | ok | 3 ok / 0 broken | pass |
| d10 | ok | 3 ok / 0 broken | pass | no | - | ok | 3 ok / 0 broken | pass |
| d11 | broken | 0 ok / 3 broken | fail | no | - | broken | 0 ok / 3 broken | fail |
| d12 | broken | 0 ok / 3 broken | fail | no | - | broken | 0 ok / 3 broken | fail |
| d13 | broken | 0 ok / 3 broken | fail | no | - | broken | 0 ok / 3 broken | fail |
| d14 | broken | 0 ok / 3 broken | fail | no | - | broken | 0 ok / 3 broken | fail |
| d15 | broken | 0 ok / 3 broken | fail | no | - | broken | 0 ok / 3 broken | fail |
| d16 | ok | 3 ok / 0 broken | pass | no | - | ok | 3 ok / 0 broken | pass |
| d17 | broken | 3 ok / 0 broken | pass | no | - | ok | 3 ok / 0 broken | pass |
| d18 | ok | 3 ok / 0 broken | pass | no | - | ok | 3 ok / 0 broken | pass |
| d19 | ok | 3 ok / 0 broken | pass | no | - | ok | 3 ok / 0 broken | pass |
| d20 | ok | 3 ok / 0 broken | pass | no | - | ok | 1 ok / 2 broken | pass |

- Each state is judged in its own session (the engine's one-state call); every state is treated as expect:pass for the escalation rules.
- The Sonnet start's escalations (to opus) are not run: their cost is an estimate from the sonnet sessions' tokens at opus rates.

Spend: batch D $1.2796 (complete); ledger total $4.0377.
