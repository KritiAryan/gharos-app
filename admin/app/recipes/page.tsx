import { createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";

const ROLE_EMOJI: Record<string, string> = {
  hero: "⭐", side: "🥗", staple: "🍚", condiment: "🫙", snack: "🥜",
};

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; cuisine?: string; verified?: string }>;
}) {
  const params  = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("recipes")
    .select("id, canonical_name, display_name, dish_role, cuisine, diet_tags, verified, extraction_confidence, created_at")
    .order("created_at", { ascending: false });

  if (params.role)     query = query.eq("dish_role", params.role);
  if (params.cuisine)  query = query.eq("cuisine", params.cuisine);
  if (params.verified === "true")  query = query.eq("verified", true);
  if (params.verified === "false") query = query.eq("verified", false);

  const { data: recipes = [] } = await query;

  // Count by role for filter pills
  const { data: allRoles } = await supabase.from("recipes").select("dish_role");
  const roleCounts = ((allRoles ?? []) as { dish_role: string }[]).reduce((a: Record<string, number>, r) => {
    a[r.dish_role] = (a[r.dish_role] ?? 0) + 1; return a;
  }, {});

  const filterUrl = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...params, ...extra });
    return `/recipes?${p}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brand-text">Recipes</h1>
          <p className="text-brand-muted text-sm mt-0.5">{recipes.length} results</p>
        </div>
        <Link
          href="/recipes/new"
          className="bg-brand-primary text-white text-sm font-medium px-4 py-2 rounded-button hover:opacity-90 transition-opacity"
        >
          ➕ Import Recipe
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Role filters */}
        {["hero", "side", "staple", "condiment", "snack"].map(role => (
          <Link key={role}
            href={filterUrl({ role: params.role === role ? "" : role })}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              params.role === role
                ? "bg-brand-primary text-white border-brand-primary"
                : "border-brand-border text-brand-text hover:bg-brand-border/30"
            }`}
          >
            {ROLE_EMOJI[role]} {role} ({roleCounts[role] ?? 0})
          </Link>
        ))}
        <div className="w-px bg-brand-border mx-1" />
        {/* Verified filter */}
        {[["true", "✅ Verified"], ["false", "⏳ Pending"]].map(([val, lbl]) => (
          <Link key={val}
            href={filterUrl({ verified: params.verified === val ? "" : val })}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              params.verified === val
                ? "bg-brand-primary text-white border-brand-primary"
                : "border-brand-border text-brand-text hover:bg-brand-border/30"
            }`}
          >
            {lbl}
          </Link>
        ))}
      </div>

      {/* Table */}
      {recipes.length === 0 ? (
        <div className="text-center py-20 text-brand-muted">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="font-medium">No recipes yet</p>
          <p className="text-sm mt-1">Import your first recipe to get started</p>
        </div>
      ) : (
        <div className="bg-brand-card border border-brand-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border bg-brand-bg">
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Recipe</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Cuisine</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Diet</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) => (
                <tr key={r.id} className="border-t border-brand-border hover:bg-brand-bg/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-text">{r.display_name}</p>
                    <p className="text-xs text-brand-muted">{r.canonical_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-brand-bg border border-brand-border rounded-full">
                      {ROLE_EMOJI[r.dish_role]} {r.dish_role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brand-text capitalize">
                    {r.cuisine?.replace(/_/g, " ") ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-brand-muted text-xs">
                    {(r.diet_tags ?? []).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.verified
                      ? <span className="text-green-600 text-xs font-medium">✅ Verified</span>
                      : <span className="text-amber-600 text-xs font-medium">⏳ Pending</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/recipes/${r.id}`}
                      className="text-xs text-brand-primary hover:underline font-medium"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
