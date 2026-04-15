// ─────────────────────────────────────────────────────────────────────────────
// Smart Pantry Categorization Service
// Step 1: local synonym dictionary (instant, zero API cost)
// Step 2: Groq llama-3.1-8b-instant fallback (only if Step 1 misses)
// Returns: { canonical_name, display_name, emoji, category }
// ─────────────────────────────────────────────────────────────────────────────

import { lookupIngredient } from "../lib/pantryDict";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const VALID_CATEGORIES = [
  "Grains & Lentils",
  "Vegetables",
  "Dairy",
  "Spices & Masalas",
  "Oils & Condiments",
  "Dry Fruits & Nuts",
  "Fruits",
  "Beverages",
  "Other",
];

// ─── LLM fallback ─────────────────────────────────────────────────────────────
async function classifyWithLLM(userInput) {
  const prompt = `You are a smart Indian kitchen assistant. Classify this pantry ingredient.

Input: "${userInput}"

Rules:
- Return ONLY valid JSON, nothing else
- "canonical_name" = lowercase English slug (e.g. "bitter_gourd", "kokum")
- "display_name" = proper English Indian name as sold in Blinkit/Zepto (e.g. "Bitter Gourd", "Kokum")
- "emoji" = most fitting single emoji
- "category" = exactly one of: ${VALID_CATEGORIES.join(" | ")}

JSON:`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 120,
      }),
    });

    if (!res.ok) throw new Error("Groq error");

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";

    // Strip markdown code fences if present
    const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    // Validate the response has all required fields
    if (!parsed.canonical_name || !parsed.display_name || !parsed.emoji || !parsed.category) {
      throw new Error("Incomplete LLM response");
    }

    // Ensure category is valid
    if (!VALID_CATEGORIES.includes(parsed.category)) {
      parsed.category = "Other";
    }

    return {
      canonical_name: parsed.canonical_name.toLowerCase().replace(/\s+/g, "_"),
      display_name: parsed.display_name,
      emoji: parsed.emoji,
      category: parsed.category,
    };
  } catch {
    // Final fallback — return a safe default
    return {
      canonical_name: userInput.toLowerCase().replace(/\s+/g, "_"),
      display_name: userInput
        .trim()
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      emoji: "🛒",
      category: "Other",
    };
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────
// Returns { canonical_name, display_name, emoji, category, source }
// source = "dict" | "llm" | "fallback"
export async function categorizeItem(userInput) {
  const trimmed = userInput.trim();
  if (!trimmed) return null;

  // Step 1: local dictionary (instant)
  const local = lookupIngredient(trimmed);
  if (local) {
    return { ...local, source: "dict" };
  }

  // Step 2: LLM classification
  const llmResult = await classifyWithLLM(trimmed);
  return {
    ...llmResult,
    source: llmResult.emoji === "🛒" ? "fallback" : "llm",
  };
}
