import { createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";

type Ingredient = {
  canonical_id:  string;
  display_name:  string;
  category:      string | null;
  unit_default:  string | null;
  aliases:       string[] | null;
  is_staple:     boolean;
  verified:      boolean;
};

export default async function IngredientCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; staple?: string }>;
}) {
  const params   = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("ingredient_catalog")
    .select("canonical_id, display_name, category, unit_default, aliases, is_staple, verified")
    .order("canonical_id");

  if (params.category)     query = query.eq("category", params.category);
  if (params.staple === "true") query = query.eq("is_staple", true);
  if (params.q) {
    // Match against canonical_id OR display_name (case-insensitive)
    query = query.or(`canonical_id.ilike.%${params.q}%,display_name.ilike.%${params.q}%`);
  }

  const { data: itemsRaw } = await query;
  const items = (itemsRaw ?? []) as Ingredient[];

  // Category counts across the full catalog (ignores filters so counts are stable)
  const { data: all } = await supabase.from("ingredient_catalog").select("category, is_staple");
  const rows = (all ?? []) as { category: string | null; is_staple: boolean }[];
  const catCounts = rows.reduce((a: Record<string, number>, r) => {
    if (r.category) a[r.category] = (a[r.category] ?? 0) + 1;
    return a;
  }, {});
  const categories  = Object.keys(catCounts).sort();
  const totalCount  = rows.length;
  const stapleCount = rows.filter(r => r.is_staple).length;

  const filterUrl = (extra: Record<string, string>) => {
    const merged = { ...params, ...extra };
    // Remove empty values
    const entries = Object.entries(merged).filter(([, v]) => v);
    const qs = new URLSearchParams(entries as [string, string][]).toString();
    return `/ingredient-catalog${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brand-text">Ingredient Catalog</h1>
          <p className="text-brand-muted text-sm mt-0.5">
            {items.length} shown · {totalCount} total · {stapleCount} staples · {categories.length} categories
          </p>
        </div>
        <Link
          href="/ingredient-catalog/new"
          className="bg-brand-primary text-white text-sm font-medium px-4 py-2 rounded-button hover:opacity-90 transition-opacity"
        >
          + New Ingredient
        </Link>
      </div>

      {/* Search + filters */}
      <form className="flex gap-3 mb-4">
        <input name="q" defaultValue={params.q ?? ""} placeholder="Search by id or name…"
          className="flex-1 border border-brand-border rounded-button px-3 py-2 text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-brand-text" />
        {params.category && <input type="hidden" name="category" value={params.category} />}
        {params.staple   && <input type="hidden" name="staple"   value={params.staple} />}
        <button type="submit" className="border border-brand-border text-brand-text text-sm px-4 py-2 rounded-button hover:bg-brand-border/30">
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5 mb-6">
        <Link href={filterUrl({ staple: params.staple === "true" ? "" : "true" })}
          className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
            params.staple === "true"
              ? "bg-green-600 text-white border-green-600"
              : "border-brand-border text-brand-text hover:bg-brand-border/30"
          }`}>
          ★ staples ({stapleCount})
        </Link>
        <span className="w-px h-4 bg-brand-border mx-1" />
        {categories.map(cat => (
          <Link key={cat} href={filterUrl({ category: params.category === cat ? "" : cat })}
            className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
              params.category === cat
                ? "bg-brand-primary text-white border-brand-primary"
                : "border-brand-border text-brand-text hover:bg-brand-border/30"
            }`}>
            {cat.replace(/_/g, " ")} ({catCounts[cat]})
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 text-brand-muted">
          <p className="text-4xl mb-3">🧄</p>
          <p className="font-medium">No ingredients match these filters.</p>
          <p className="text-sm mt-1">Try clearing the search or filters, or add a new ingredient.</p>
        </div>
      ) : (
        <div className="bg-brand-card border border-brand-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border bg-brand-bg">
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Canonical ID</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Display Name</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Unit</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Aliases</th>
                <th className="text-left px-4 py-3 font-medium text-brand-muted text-xs uppercase tracking-wide">Flags</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.canonical_id} className="border-t border-brand-border hover:bg-brand-bg/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/ingredient-catalog/${encodeURIComponent(item.canonical_id)}`}
                      className="text-brand-primary hover:underline">
                      {item.canonical_id}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-brand-text">{item.display_name}</td>
                  <td className="px-4 py-2.5 text-brand-muted text-xs capitalize">{item.category?.replace(/_/g, " ") ?? "—"}</td>
                  <td className="px-4 py-2.5 text-brand-muted text-xs">{item.unit_default ?? "—"}</td>
                  <td className="px-4 py-2.5 text-brand-muted text-xs max-w-xs truncate">
                    {(item.aliases ?? []).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    {item.is_staple && <span className="mr-1 text-green-600">★ staple</span>}
                    {item.verified  && <span className="text-emerald-600">✓</span>}
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
