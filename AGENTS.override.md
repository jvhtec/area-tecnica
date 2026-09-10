# Area Tecnica agent orchestration override

Before doing any repository work, read and follow `AGENTS.md` in full. Its technical, validation, branch, PR, and release rules remain authoritative. Also read the companion documents it requires for the area you touch.

This override adds repository-specific delegation and model-routing policy. The user's explicit request always controls scope.

## Default operating model

Use **Sol** as the default prime/orchestrator and general engineering model. Small, obvious changes should stay with Sol rather than spawning a committee for sport.

Use **Luna** for cheap, parallel, mostly read-only investigation:
- repository archaeology and dependency tracing
- locating ownership boundaries and affected files
- focused Supabase/schema/RLS investigation
- external API, library, or protocol research
- independent fact gathering before implementation

Use **Sol** for:
- normal implementation and debugging
- TypeScript/React application logic
- Supabase/RPC/RLS implementation after the problem is understood
- PDF/reporting logic
- refactors, tests, CI/build fixes, and integration
- final diff inspection and ordinary verification

## UI specialization

For **substantial UI/UX work**, prefer this sequence:

1. **Claude Opus, UI architect, normally read-only**
   - inspect the existing design system and adjacent workflows
   - define information hierarchy, component boundaries, states, interactions, responsive behavior, accessibility, and acceptance criteria
   - return a concrete implementation plan rather than broad aesthetic advice
2. **Claude Sonnet, UI implementer**
   - implement the accepted plan using existing shadcn/Tailwind/application patterns
   - keep scope bounded and do not redesign unrelated surfaces
3. **Sol, independent integrator/reviewer**
   - inspect the complete diff, run the relevant checks, and verify the original requirement

Do not use the same Opus pass as both architect and supposedly independent reviewer. If Opus designed it, Sol reviews it unless escalation is genuinely warranted.

For small UI fixes, Sol or Sonnet may implement directly. Do not invoke Opus merely because CSS exists.

## Astra escalation policy

**Astra is expensive and is not a default worker, reviewer, explorer, or orchestrator.** Reserve it for work where the extra capability is likely to materially change the result.

Appropriate Astra cases include:
- major cross-cutting architecture that is costly to reverse
- redesign of the job/tour/defaults/Flex data model or other core domain boundaries
- difficult Supabase/RLS/authorization architecture with several interacting security constraints
- financial/personnel/reporting correctness problems with substantial ambiguity and high consequence
- hard bugs spanning multiple subsystems after Luna/Sol have already isolated the problem
- an independent review of a genuinely high-risk architectural change

Do **not** use Astra merely because a task is large, touches many files, has a PR, or would benefit from generic second opinions.

Before escalating, the prime must give Astra a compact evidence packet containing:
- exact objective and constraints
- relevant architecture and files
- established findings
- tests/reproductions already run
- failed approaches, if any
- unresolved decisions or hypotheses

Do not pay Astra to rediscover information Luna or Sol can gather first.

## Repository-specific routing

Prefer the following paths unless the task gives a reason to deviate:

- Routine change: **Sol -> Sol verification**
- Unfamiliar engineering change: **Luna investigate -> Sol implement -> Sol verify**
- Substantial UI: **Opus architect -> Sonnet implement -> Sol verify**
- High-risk data/auth/reporting change: **Luna investigate -> Sol implement -> Astra independent review only when the consequence/ambiguity justifies it -> Sol integrates fixes**
- Hard architecture: **Luna/Sol gather evidence -> Astra resolves the difficult architectural question -> Sol implements/integrates -> independent verification**

Parallelize independent investigation when useful, but avoid overlapping edits between workers. The prime owns integration and final correctness. Worker conclusions are hypotheses, not votes.

## Area Tecnica risk triggers

Treat these as candidates for stronger review, not automatic Astra calls:
- Supabase migrations, RLS, grants, auth, or RPC authorization
- rate/payments/timesheet/money calculations and financial PDFs
- personnel assignment/conflict/offer logic
- Flex folder creation or synchronization across job/tour/tourdate types
- tour defaults/package-size propagation and compatibility
- shared PDF/layout infrastructure used by several reports
- deployment/build changes that can create false confidence between preview and production

For these areas, first increase evidence and tests. Escalate model cost only when the remaining reasoning problem actually warrants it.
