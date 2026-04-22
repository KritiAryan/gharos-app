import Link from "next/link";
import IngredientForm from "../_form";

export default function NewIngredientPage() {
  return (
    <div>
      <Link href="/ingredient-catalog" className="text-xs text-brand-muted hover:text-brand-text mb-1 inline-flex items-center gap-1">
        ← Catalog
      </Link>
      <h1 className="font-serif text-2xl font-bold text-brand-text mb-6">New Ingredient</h1>
      <IngredientForm mode="create" />
    </div>
  );
}
