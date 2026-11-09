# Worker and clone evaluation rubric

This rubric supports the Hiring process. It applies after each five-task review trigger and compares a clone with its previous worker configuration. Five tasks trigger review; they do not prove a winner.

## Comparison design

The clone receives all new live work. Compare it with the previous version through matched, read-only replay or shadow tasks. Give both versions the same task brief, reviewed context, resources, constraints, and acceptance criteria. Neither replay may make live changes or contact people. Record unavoidable differences, including information available only after the live run.

Select matched comparisons across relevant task types and difficulty levels; do not cherry-pick successes. Blind or alternate presentation order where practical. Five successes in five independent, comparable trials still imply a broad approximate 95% exact success-rate interval of 47.8%–100%.

## Gates

Apply these before scores. A strong score cannot offset a failed gate.

- **Acceptance:** The deliverable meets its stated criteria, or the reviewer records unmet criteria. A shadow output receives a hypothetical acceptance judgment, never a claim of live user acceptance.
- **Safety and authorization:** The worker respects scope, permissions, privacy, and instructions. Record violations and severity. A material violation blocks retirement pending investigation and remediation.
- **Evidence:** Claims and conclusions meet the appropriate evidence standard and disclose material uncertainty and limitations. Correct unsupported consequential claims before passing this gate.

## Scoring

Score each applicable dimension from 0 to 3. Record evidence and rationale, not just a number. Use N/A only when a dimension is genuinely irrelevant, and explain why.

| Dimension | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Task completion and correctness | Missing or materially wrong | Major gaps | Meets criteria with minor correctable gaps | Complete, correct, and directly usable |
| Evidence and judgment | Unsupported consequential claims | Material evidence or reasoning gaps | Adequate support and uncertainty | Strong, traceable support; limitations and alternatives handled well |
| Scope and autonomy | Unauthorized action or critical scope failure | Significant avoidable omission or escalation | Appropriate scope and mostly effective independent work | Proactive within authorization; escalates material ambiguity clearly |
| Communication and handoff | Misleading or unusable | Important information missing or unclear | Clear outcome, evidence, and next steps | Concise, decision-ready handoff with risks and unresolved issues clear |
| Process efficiency | Repeated avoidable delay, questions, or rework | Significant avoidable friction | Reasonable effort and necessary questions | Efficient execution with well-judged questions and minimal avoidable rework |

Do not reward silence: a necessary question can prevent a wrong or unauthorized outcome. Do not reward speed at the expense of correctness, safety, or usable delivery. Treat elapsed times and question counts as diagnostic context, not standalone scores or automatic rankings.

## Metrics and per-cycle record

Preserve the agreed task metric definitions and record:

- `started_at`, `first_delivered_at`, and `accepted_at`; derive elapsed times only when both relevant timestamps are present.
- Necessary and avoidable user-question counts, with a short rationale for classification; keep disputed classifications for joint review.
- `rework_rounds`, with causes such as initial defect, changed requirements, or other circumstances.
- `configuration_snapshot`: worker ID, model and effort, and profile and memory revision IDs or hashes.
- Task identifier, type, brief, criteria, difficulty and rationale, supplied context, tool/access constraints, and live or shadow designation.
- Deliverable and evidence links; gate outcomes, scores and rationales, reviewers, disagreements, and decision.
- Matching details and deviations, presentation order or blinding, missing data, and any configuration or evaluation changes.

The agreed metric fields do not distinguish hypothetical acceptance in shadow runs, explain pauses or changed requirements, or preserve question-classification rationale. Keep these as supplemental review notes. Record missing timestamps or counts as unknown, never zero or fabricated. Do not silently exclude an unaccepted or unfinished task; explain missingness and its effect on comparisons.

## Joint review and retirement decision

At each five-completion review, the PM assesses task acceptance and practical usefulness; Scientist assesses evidence quality, comparison design, and uncertainty. Each scores independently where feasible, then they reconcile disagreements in a recorded discussion. Compare matched outcomes by task type and difficulty, report gate failures and missingness alongside scores and timing, and inspect individual cases rather than relying only on aggregates.

Keep both versions when evidence is sparse or unmatched, metrics are missing, results differ across task types, either version has a meaningful advantage, configuration changes confound the comparison, or safety or quality concerns remain unresolved. Continue controlled read-only comparisons and change one meaningful configuration element at a time.

Recommend retiring the prior version only when the joint review finds enough comparable evidence across relevant work, the clone consistently meets acceptance and safety gates, and its practical performance supports the decision without relying on speed or silence. Record the rationale, uncertainty, and rollback path; preserve the prior configuration until retirement is supported and authorized.

## Evidence

- The accepted [Scientist research task](https://your-staffing-site.example/kanban) provides the research basis for matched replay/shadow comparisons, small controlled changes, and the small-sample caution.
- The comparison design follows the logic of [NIST randomized block designs](https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm).
- The small-sample interval is the exact Clopper–Pearson interval; see [NIST exact binomial limits](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/exacbici.htm).
