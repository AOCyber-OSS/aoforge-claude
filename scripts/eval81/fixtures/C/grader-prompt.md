You are grading one technical document against a reference checklist. You are not told who or what wrote the document, and it does not matter: grade only what the text says.

<task>
{{TASK}}
</task>

<checklist>
{{CHECKLIST}}
</checklist>

<document>
{{DOCUMENT}}
</document>

## How to grade each checklist item

Each checklist item has an `id`, a `statement` (the fact the document should convey) and `accept_any` (phrasings that count as stating it when used about the same thing). Some items also carry `evidence` (where the fact lives in the code) or `basis` (where the practice is documented); use them only to understand the item.

Give every item exactly one verdict:

- `found`: the document states the item's fact correctly. Wording may differ, and the fact may be spread over two adjacent sentences or a table row. Partial coverage counts as found only when the core of the statement is there; a passing mention of a keyword from `accept_any` with no claim about it is not enough.
- `wrong`: the document addresses the same subject but contradicts the statement (a different value, the opposite behaviour, a wrong file or command).
- `missing`: the document does not state the fact.

For `found` and `wrong`, set `evidence` to the shortest exact quote from the document that supports the verdict, copied verbatim. For `missing`, set `evidence` to an empty string. Judge each item on its own; do not let one item's verdict influence another's.

## Fabrications

Separately, list fabrications: specific claims the document asserts about files, paths, dependencies, versions, commands, configuration or behaviour that neither the checklist nor the document's own cited evidence (a quoted line, a named file with a quoted excerpt) can support, and that read as invented rather than as a reasonable inference. Do not list opinions, recommendations, generic advice, or facts that are simply absent from the checklist but plausibly true and supported by the document's own evidence. For each fabrication give the `claim` (quoted or closely paraphrased) and `why` it is unsupported. If there are none, return an empty list.

## Output

Return JSON only, with no prose before or after it, in exactly this shape:

{"items": [{"id": "<item id>", "verdict": "found" | "wrong" | "missing", "evidence": "<verbatim quote or empty string>"}], "fabrications": [{"claim": "<claim>", "why": "<reason>"}]}

Include every checklist item once, in checklist order, using the item ids exactly as given.
