import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import IngredientForm from "../_form";
import type { IngredientPayload } from "../actions";

export default async function EditIngredientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ingredient_catalog")
    .select("*")
    .eq("canonical_id", id)
    .single();

  if (error || !data) notFound();

  const initial: Partial<IngredientPayload> & { canonical_id: string } = {
    canonical_id: data.canonical_id,
    display_name: data.display_name ?? "",
    category:     data.category,
    unit_default: data.unit_default,
    aliases:      data.aliases   ?? [],
    allergens:    data.allergens ?? [],
    season:       data.season    ?? [],
    is_staple:    data.is_staple ?? false,
    verified:     data.verified  ?? false,
    notes:        data.notes,
  };

  return (
    <div>
      <Link href="/ingredient-catalog" className="text-xs text-brand-muted hover:text-brand-text mb-1 inline-flex items-center gap-1">
        ← Catalog
      </Link>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="font-serif text-2xl font-bold text-brand-text">{data.display_name}</h1>
        {data.is_staple && <span className="text-xs text-green-600 font-medium">staple</span>}
      </div>
      <p className="text-brand-muted text-xs font-mono mb-6">{data.canonical_id}</p>
      <IngredientForm mode="edit" initial={initial} />
    </div>
  );
}
