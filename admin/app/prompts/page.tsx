// Prompts editor — will display and allow editing of B1, B2, image-gen,
// and Agent A prompts once those agents are wired up (Phase 2 onwards).

const PROMPTS = [
  {
    id: "b1_extraction",
    label: "Agent B1 — Recipe Extractor",
    phase: 2,
    description: "Extracts structured recipe data (ingredients, steps, tips, FAQs, pairing) from Jina-fetched markdown.",
    status: "active",
  },
  {
    id: "b2_prep_planner",
    label: "Agent B2 — Prep Planner",
    phase: 4,
    description: "Given a structured recipe from B1, normalises ingredient canonical_ids against the catalog, refines key_ingredients, and generates batch-prep components with storage options and shelf life.",
    status: "active",
  },
  {
    id: "image_gen",
    label: "Image Generation — Gemini",
    phase: 5,
    description: "Generates a brand-consistent food photo using the recipe name, dish type, cuisine, and region to determine vessel and styling.",
    status: "pending",
  },
  {
    id: "agent_a_llm_tiebreak",
    label: "Agent A — LLM Last-Mile Selector",
    phase: 6,
    description: "Given top-N scored candidates, selects 21 meals for a balanced, non-repetitive week. Only reorders — never invents.",
    status: "pending",
  },
  {
    id: "agent_e_scheduler",
    label: "Agent E — Prep Scheduler",
    phase: 7,
    description: "Deterministic scheduler — no LLM. Uses prep_components + cook dates to assign tasks to days respecting shelf life.",
    status: "none",
  },
];

export default function PromptsPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-brand-text mb-1">Prompts</h1>
      <p className="text-brand-muted text-sm mb-8">
        View and edit LLM prompts used by each agent. Prompts are activated as each phase is built.
      </p>

      <div className="space-y-4">
        {PROMPTS.map((p) => (
          <div key={p.id} className="bg-brand-card border border-brand-border rounded-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-serif font-semibold text-brand-text">{p.label}</h2>
                  <span className="text-xs text-brand-muted border border-brand-border px-2 py-0.5 rounded-full">
                    Phase {p.phase}
                  </span>
                </div>
                <p className="text-sm text-brand-muted">{p.description}</p>
              </div>
              {p.status === "pending" && (
                <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2 py-1 rounded-full shrink-0">
                  Coming in Phase {p.phase}
                </span>
              )}
              {p.status === "active" && (
                <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1 rounded-full shrink-0">
                  Active
                </span>
              )}
              {p.status === "none" && (
                <span className="text-xs bg-brand-bg border border-brand-border text-brand-muted px-2 py-1 rounded-full shrink-0">
                  Deterministic — no prompt
                </span>
              )}
            </div>

            {p.status === "pending" && (
              <div className="mt-4 bg-brand-bg border border-brand-border rounded-button p-3 text-xs text-brand-muted font-mono">
                Prompt will appear here once Phase {p.phase} is complete.
                You will be able to edit and test it directly from this panel.
              </div>
            )}

            {p.status === "active" && (
              <div className="mt-4 bg-brand-bg border border-brand-border rounded-button p-3 text-xs text-brand-muted">
                Prompt is live. Source lives in the agent&apos;s server action — edit it there and redeploy.
                {p.id === "b1_extraction" && <span className="font-mono block mt-1">admin/app/recipes/new/actions.ts · SYSTEM_PROMPT</span>}
                {p.id === "b2_prep_planner" && <span className="font-mono block mt-1">admin/app/recipes/[id]/run-b2.ts · B2_SYSTEM_PROMPT</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
