"use server";

// ─── Gemini image generation ─────────────────────────────────────────────────
//
// Given a recipe id, builds a prompt from its display_name / cuisine / dish_type
// / key_ingredients, calls Gemini 2.5 Flash Image, uploads the resulting PNG to
// Supabase Storage (bucket `recipe-images`) at `{recipe_id}/{timestamp}.png`,
// and updates recipes.image_storage_path.
//
// Does NOT touch any other recipe field. Safe to re-run — each regeneration
// uploads a new file with a fresh timestamp and just rewrites the pointer.

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { buildImagePrompt } from "./image-prompt";

export type ImageResult =
  | { ok: true; image_storage_path: string; public_url: string; prompt: string }
  | { ok: false; error: string };

export async function runGeminiImage(recipeId: string): Promise<ImageResult> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not configured on server" };

    const supabase = createAdminClient();

    // 1. Load the subset of the recipe we need for the prompt
    const { data: recipe, error: loadErr } = await supabase
      .from("recipes")
      .select("display_name, description, cuisine, region, dish_type, dish_role, key_ingredients")
      .eq("id", recipeId)
      .single();

    if (loadErr || !recipe) {
      return { ok: false, error: loadErr?.message ?? "Recipe not found." };
    }

    // 2. Build prompt
    const prompt = buildImagePrompt({
      display_name:    recipe.display_name as string,
      description:     recipe.description   as string | null,
      cuisine:         recipe.cuisine       as string | null,
      region:          recipe.region        as string | null,
      dish_type:       recipe.dish_type     as string | null,
      dish_role:       recipe.dish_role     as string | null,
      key_ingredients: recipe.key_ingredients as string[] | null,
    });

    // 3. Call Gemini 2.5 Flash Image
    //    https://ai.google.dev/gemini-api/docs/image-generation
    //    The response contains inlineData parts with base64-encoded PNG.
    const pngBase64 = await callGeminiImage(apiKey, prompt);

    // 4. Upload to Supabase Storage
    const pngBuffer = Buffer.from(pngBase64, "base64");
    const storagePath = `${recipeId}/${Date.now()}.png`;

    const { error: uploadErr } = await supabase.storage
      .from("recipe-images")
      .upload(storagePath, pngBuffer, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) {
      return { ok: false, error: `Storage upload failed: ${uploadErr.message}` };
    }

    // 5. Update recipe pointer
    const { error: updateErr } = await supabase
      .from("recipes")
      .update({ image_storage_path: storagePath })
      .eq("id", recipeId);

    if (updateErr) {
      return { ok: false, error: `DB update failed: ${updateErr.message}` };
    }

    revalidatePath(`/recipes/${recipeId}`);

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recipe-images/${storagePath}`;

    return { ok: true, image_storage_path: storagePath, public_url: publicUrl, prompt };
  } catch (e) {
    console.error("[runGeminiImage]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Image generation failed." };
  }
}

// ─── Gemini call ────────────────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: { message: string };
}

async function callGeminiImage(apiKey: string, prompt: string): Promise<string> {
  const model = "gemini-2.5-flash-image-preview";
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: prompt }] },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],   // ask only for image, not text
      },
    }),
    signal: AbortSignal.timeout(90000),  // 90s — image gen can be slow
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as GeminiResponse;
  if (json.error) throw new Error(`Gemini: ${json.error.message}`);

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(p => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    // Dump the first text part for debuggability if no image came back
    const textPart = parts.find(p => p.text)?.text;
    throw new Error(
      textPart
        ? `Gemini returned text instead of an image: ${textPart.slice(0, 200)}`
        : "Gemini returned no image data."
    );
  }

  return imagePart.inlineData.data;
}
