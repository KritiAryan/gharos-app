"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const nav = [
  { href: "/dashboard",           label: "Dashboard",          icon: "📊" },
  { href: "/recipes",             label: "Recipes",            icon: "🍲" },
  { href: "/recipes/new",         label: "Import Recipe",      icon: "➕" },
  { href: "/ingredient-catalog",  label: "Ingredient Catalog", icon: "🧄" },
  { href: "/prompts",             label: "Prompts",            icon: "🧠" },
  { href: "/scoring-lab",         label: "Scoring Lab",        icon: "⚖️"  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-56 min-h-screen bg-brand-sidebar flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <p className="text-white font-serif font-bold text-lg leading-tight">GharOS</p>
        <p className="text-white/40 text-xs mt-0.5">Manager Panel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-brand-primary text-white font-medium"
                  : "text-white/60 hover:text-white hover:bg-brand-sidebar-hover"
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-white/50 hover:text-white hover:bg-brand-sidebar-hover transition-colors"
        >
          <span>🚪</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
