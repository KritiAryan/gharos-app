import { createAdminClient } from "@/lib/supabase/server";

export default async function IngredientCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params   = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("ingredient_catalog")
    .select("*")
    .order("canonical_id");

  if (params.category) query = query.eq("category", params.category);
  if (params.q)        query = query.ilike("canonical_id", `%${params.q}%`);

  const { data: items = [] } = await query;

  // Category counts
  const { data: all } = await supabase.from("ingredient_catalog").select("category");
  const catCounts = ((all ?? []) as { category: string }[]).reduce((a: Record<string, number>, r) => {
    if (r.category) { a[r.category] = (a[r.category] ?? 0) + 1; }
    return a;
  }, {});
  const categories = Object.keys(catCounts).sort();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brand-text">Ingredient Catalog</h1>
          <p className="text-brand-muted text-sm mt-0.5">{items.length} ingredients · {Object.keys(catCounts).length} categories</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-button">
          🌱 Seed CSV import coming in Phase 3
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 mb-6">
        <form className="flex-1">
          <input name="q" defaultValue={params.q} placeholder="Search canonical_id…"
            className="w-full border border-brand-border rounded-button px-3 py-2 text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
        </form>
        <div className="flex flex-wrap gap-1.5">
          {categories.slice(0, 8).map(cat => (
            <a key={cat} href={`/ingredient-catalog?category=${params.category === cat ? "" : cat}`}
              className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                params.category === cat
                  ? "bg-brand-primary text-white border-brand-primary"
                  : "border-brand-border text-brand-text hover:bg-brand-border/30"
              }`}>
              {cat} ({catCounts[cat]})
            </a>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 text-brand-muted">
          <p className="text-4xl mb-3">🧄</p>
          <p className="font-medium">No ingredients yet</p>
          <p className="text-sm mt-1">The seed CSV will populate this catalog in Phase 3.</p>
        </div>
      ) : (
        <div className="bg-brand-card border border-brand-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border bg-brand-bg">
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Canonical ID</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Display Name</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Aliases</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Cost</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Flags</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.canonical_id} className="border-t border-brand-border hover:bg-brand-bg/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-brand-text">{item.canonical_id}</td>
                  <td className="px-4 py-2.5 text-brand-text">{item.display_name} {item.emoji ?? ""}</td>
                  <td className="px-4 py-2.5 text-brand-muted text-xs capitalize">{item.category?.replace(/_/g, " ") ?? "—"}</td>
                  <td className="px-4 py-2.5 text-brand-muted text-xs max-w-xs truncate">
                    {(item.aliases ?? []).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-brand-muted text-xs">
                    {item.typical_cost_inr ? `₹${item.typical_cost_inr}/${item.typical_pack_size}${item.typical_pack_unit}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {item.is_staple   && <span className="mr-1 text-green-600">staple</span>}
                    {item.is_spice    && <span className="mr-1 text-amber-600">spice</span>}
                    {item.is_perishable && <span className="text-blue-600">perishable</span>}
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
