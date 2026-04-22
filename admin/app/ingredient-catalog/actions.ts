"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type IngredientPayload = {
  canonical_id:  string;
  display_name:  string;
  category:      string | null;
  unit_default:  string | null;
  aliases:       string[];
  allergens:     string[];
  season:        string[];
  is_staple:     boolean;
  verified:      boolean;
  notes:         string | null;
};

export type CatalogResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function formatError(error: { message?: string; code?: string; hint?: string; details?: string }): string {
  const msg   = error.message ?? "Unknown DB error";
  const code  = error.code    ? ` (code ${error.code})` : "";
  const hint  = error.hint    ? ` · hint: ${error.hint}` : "";
  const det   = error.details ? ` · ${error.details}`   : "";
  return `${msg}${code}${hint}${det}`;
}

export async function createIngredient(payload: IngredientPayload): Promise<CatalogResult> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ingredient_catalog")
      .insert(payload)
      .select("canonical_id")
      .single();
    if (error) return { ok: false, error: formatError(error) };
    revalidatePath("/ingredient-catalog");
    return { ok: true, id: data.canonical_id };
  } catch (e) {
    console.error("[createIngredient]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Create failed." };
  }
}

export async function updateIngredient(
  canonical_id: string,
  payload: Partial<IngredientPayload>
): Promise<CatalogResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("ingredient_catalog")
      .update(payload)
      .eq("canonical_id", canonical_id);
    if (error) return { ok: false, error: formatError(error) };
    revalidatePath("/ingredient-catalog");
    revalidatePath(`/ingredient-catalog/${canonical_id}`);
    return { ok: true, id: canonical_id };
  } catch (e) {
    console.error("[updateIngredient]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." };
  }
}

export async function deleteIngredient(canonical_id: string): Promise<CatalogResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("ingredient_catalog")
      .delete()
      .eq("canonical_id", canonical_id);
    if (error) return { ok: false, error: formatError(error) };
    revalidatePath("/ingredient-catalog");
    return { ok: true, id: canonical_id };
  } catch (e) {
    console.error("[deleteIngredient]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed." };
  }
}

/** Redirect after a successful create — used from the form submit handler. */
export async function createIngredientAndRedirect(payload: IngredientPayload): Promise<void> {
  const result = await createIngredient(payload);
  if (!result.ok) throw new Error(result.error);
  redirect(`/ingredient-catalog/${result.id}`);
}
