// Scoring Lab — simulate Agent A pantry-aware scoring for a test profile.
// Will be interactive once Agent A scoring pipeline is built in Phase 6.

export default function ScoringLabPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-brand-text mb-1">Scoring Lab</h1>
      <p className="text-brand-muted text-sm mb-8">
        Test Agent A's pantry-aware scoring algorithm against a simulated user profile and pantry.
        Use this to tune scoring weights before shipping changes to users.
      </p>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Simulated profile */}
        <div className="bg-brand-card border border-brand-border rounded-card p-5">
          <h2 className="font-serif font-semibold text-brand-text mb-4 text-sm uppercase tracking-wide">Test Profile</h2>
          <div className="space-y-3 text-sm text-brand-muted">
            <p>• Persons: <span className="text-brand-text font-medium">4</span></p>
            <p>• Diet: <span className="text-brand-text font-medium">Vegetarian</span></p>
            <p>• Cuisines: <span className="text-brand-text font-medium">North Indian, South Indian</span></p>
            <p>• Calorie target: <span className="text-brand-text font-medium">1800 kcal/day</span></p>
          </div>
          <p className="text-xs text-brand-muted mt-4 italic">Profile input will be editable in Phase 6.</p>
        </div>

        {/* Simulated pantry */}
        <div className="bg-brand-card border border-brand-border rounded-card p-5">
          <h2 className="font-serif font-semibold text-brand-text mb-4 text-sm uppercase tracking-wide">Test Pantry</h2>
          <p className="text-sm text-brand-muted mb-2">Canonical IDs (one per line):</p>
          <textarea
            disabled
            placeholder={"rice\ndal\nonion\ntomato\nspinach\npaneer\noil\nsalt\ngaram_masala\ncumin_seeds"}
            className="w-full h-32 border border-brand-border rounded-button px-3 py-2 text-xs font-mono bg-brand-bg text-brand-text resize-none opacity-50 cursor-not-allowed"
          />
          <p className="text-xs text-brand-muted mt-2 italic">Pantry input will be editable in Phase 6.</p>
        </div>
      </div>

      {/* Run button placeholder */}
      <div className="bg-brand-card border border-brand-border rounded-card p-8 text-center">
        <p className="text-4xl mb-3">⚖️</p>
        <p className="font-serif font-semibold text-brand-text mb-1">Scoring Lab — Coming in Phase 6</p>
        <p className="text-sm text-brand-muted mb-4">
          Once Agent A's scoring pipeline is built, this lab will show you:<br/>
          candidate recipes ranked by pantry-fit score · tier assignments (T1/T2/T3) ·
          missing ingredients per recipe · calorie fit · the final weekly plan output.
        </p>
        <button disabled
          className="bg-brand-primary text-white text-sm px-6 py-2 rounded-button opacity-40 cursor-not-allowed">
          Run Scoring Simulation
        </button>
      </div>
    </div>
  );
}
