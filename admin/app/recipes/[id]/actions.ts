"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { normaliseRecipeEnums } from "@/lib/recipe-enums";

export type UpdateResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateRecipe(id: string, payload: Record<string, unknown>): Promise<UpdateResult> {
  try {
    const supabase = createAdminClient();
    const safePayload = normaliseRecipeEnums(payload);
    const { error } = await supabase.from("recipes").update(safePayload).eq("id", id);
    if (error) {
      const msg = error.message || "Unknown DB error";
      const code = error.code ? ` (code ${error.code})` : "";
      const hint = error.hint ? ` · hint: ${error.hint}` : "";
      const details = error.details ? ` · ${error.details}` : "";
      return { ok: false, error: `${msg}${code}${hint}${details}` };
    }
    revalidatePath(`/recipes/${id}`);
    revalidatePath(`/recipes`);
    return { ok: true };
  } catch (e) {
    console.error("[updateRecipe]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." };
  }
}

export async function deleteRecipe(id: string): Promise<UpdateResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/recipes`);
    return { ok: true };
  } catch (e) {
    console.error("[deleteRecipe]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed." };
  }
}
