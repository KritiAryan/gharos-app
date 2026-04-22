import { createAdminClient } from "@/lib/supabase/server";

async function getStats() {
  const supabase = createAdminClient();

  const [recipes, catalog, history] = await Promise.all([
    supabase.from("recipes").select("id, dish_role, cuisine, verified, diet_tags"),
    supabase.from("ingredient_catalog").select("canonical_id, category"),
    supabase.from("meal_history").select("id"),
  ]);

  const r = recipes.data ?? [];
  const c = catalog.data ?? [];

  const byRole = r.reduce<Record<string, number>>((acc, row) => {
    acc[row.dish_role] = (acc[row.dish_role] ?? 0) + 1;
    return acc;
  }, {});

  const byCuisine = r.reduce<Record<string, number>>((acc, row) => {
    if (row.cuisine) acc[row.cuisine] = (acc[row.cuisine] ?? 0) + 1;
    return acc;
  }, {});

  const byCategory = c.reduce<Record<string, number>>((acc, row) => {
    if (row.category) acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalRecipes:   r.length,
    verified:       r.filter(x => x.verified).length,
    unverified:     r.filter(x => !x.verified).length,
    byRole,
    byCuisine,
    totalCatalog:   c.length,
    byCategory,
    totalHistory:   (history.data ?? []).length,
  };
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-card p-5">
      <p className="text-xs text-brand-muted uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-brand-text">{value}</p>
      {sub && <p className="text-xs text-brand-muted mt-1">{sub}</p>}
    </div>
  );
}

function BreakdownTable({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;
  return (
    <div className="bg-brand-card border border-brand-border rounded-card p-5">
      <h3 className="font-serif font-semibold text-brand-text mb-3">{title}</h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([key, count]) => (
            <tr key={key} className="border-t border-brand-border first:border-0">
              <td className="py-1.5 text-brand-text capitalize">{key.replace(/_/g, " ")}</td>
              <td className="py-1.5 text-right font-medium text-brand-primary">{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Dashboard() {
  const stats = await getStats();

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-brand-text mb-1">Dashboard</h1>
      <p className="text-brand-muted text-sm mb-8">GharOS recipe library status</p>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Recipes"      value={stats.totalRecipes} />
        <StatCard label="Verified"           value={stats.verified}   sub={`${stats.unverified} pending review`} />
        <StatCard label="Ingredient Catalog" value={stats.totalCatalog} />
        <StatCard label="Meal History Rows"  value={stats.totalHistory} />
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BreakdownTable title="By Dish Role"  data={stats.byRole} />
        <BreakdownTable title="By Cuisine"    data={stats.byCuisine} />
        <BreakdownTable title="Catalog by Category" data={stats.byCategory} />
      </div>

      {/* Quick actions */}
      <div className="mt-8 flex gap-3">
        <a href="/recipes/new"
           className="inline-flex items-center gap-2 bg-brand-primary text-white text-sm font-medium px-4 py-2 rounded-button hover:opacity-90 transition-opacity">
          ➕ Import Recipe
        </a>
        <a href="/recipes"
           className="inline-flex items-center gap-2 border border-brand-border text-brand-text text-sm font-medium px-4 py-2 rounded-button hover:bg-brand-border/30 transition-colors">
          🍲 Browse Recipes
        </a>
        <a href="/ingredient-catalog"
           className="inline-flex items-center gap-2 border border-brand-border text-brand-text text-sm font-medium px-4 py-2 rounded-button hover:bg-brand-border/30 transition-colors">
          🧄 Ingredient Catalog
        </a>
      </div>
    </div>
  );
}
