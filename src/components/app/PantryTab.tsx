"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Camera, Check, ChefHat, ChevronRight, ExternalLink, Flame, Loader2,
  Minus, Pencil, Plus, Search, Settings2, Sparkles, Trash2, Utensils, Video, X,
} from "lucide-react";
import { Portal } from "@/components/ui/Portal";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { usePantry, useKitchen, type PantryEntry } from "@/lib/hooks/usePantry";
import {
  savePantryItem, updatePantryItem, deletePantryItem, logFoodItem, saveInventoryFood,
} from "@/lib/db/userDb";
import { todayPacificKey } from "@/lib/firebase/dining";
import {
  PANTRY_CATEGORIES, searchIngredients, findRecipes, estimateRecipeNutrition,
  type IngredientResult, type Recipe,
} from "@/lib/pantry/pantry";
import { haptic } from "@/lib/utils/haptics";

const ACCESS_LABEL: Record<string, string> = { none: "No kitchen", shared: "Shared kitchen", full: "Full kitchen" };
const CAT_EMOJI: Record<string, string> = {
  produce: "🥬", protein: "🍗", grain: "🌾", dairy: "🥛", snack: "🍿",
  condiment: "🧂", frozen: "🧊", beverage: "🥤", other: "🍽️",
};

export function PantryTab({ onScanShelf, canScan = true }: { onScanShelf: () => void; canScan?: boolean }) {
  const handle = useUserDb();
  const { items: pantry } = usePantry();
  const { kitchen } = useKitchen();
  const today = todayPacificKey();

  const access = kitchen?.access ?? "shared";
  const appliances = useMemo(() => kitchen?.appliances ?? [], [kitchen]);

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<PantryEntry | null>(null);
  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2400); };

  // Ingredient search (Open Food Facts — foods with photos).
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IngredientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchAbort.current?.abort();
      const ctrl = new AbortController();
      searchAbort.current = ctrl;
      searchIngredients(q, ctrl.signal)
        .then((r) => { if (!ctrl.signal.aborted) setResults(r); })
        .catch(() => {})
        .finally(() => { if (!ctrl.signal.aborted) setSearching(false); });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function addFromSearch(r: IngredientResult) {
    if (!handle) return;
    await savePantryItem(handle.db, handle.uid, {
      name: r.name,
      category: r.category || "other",
      ...(r.image ? { image: r.image } : {}),
    }).catch(() => {});
    haptic("light"); flash(`Added ${r.name}`);
  }

  // Manual add.
  const [manualName, setManualName] = useState("");
  async function addManual() {
    if (!handle || !manualName.trim()) return;
    await savePantryItem(handle.db, handle.uid, { name: manualName.trim(), category: "other" }).catch(() => {});
    setManualName(""); haptic("success");
  }

  async function saveEdit(patch: { name: string; quantity: string; category: string }) {
    if (!handle || !editItem) return;
    await updatePantryItem(handle.db, handle.uid, editItem.id, {
      name: patch.name.trim() || editItem.name,
      quantity: patch.quantity.trim(),
      category: patch.category,
    }).catch(() => {});
    setEditItem(null); haptic("success");
  }
  async function removeEdit() {
    if (!handle || !editItem) return;
    await deletePantryItem(handle.db, handle.uid, editItem.id).catch(() => {});
    setEditItem(null); haptic("medium");
  }

  // Recipes.
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [onlyMakeable, setOnlyMakeable] = useState(true);
  const [recipeQuery, setRecipeQuery] = useState("");
  const [maxBuy, setMaxBuy] = useState<number | null>(null); // null = any
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null);
  const ingredientNames = useMemo(() => pantry.map((p) => p.name), [pantry]);

  async function runFindRecipes() {
    setError(null); setFinding(true); setRecipes(null);
    try {
      const { recipes: found } = await findRecipes({ ingredients: ingredientNames, appliances, access });
      setRecipes(found);
      if (found.length === 0) setError("No matching recipes found. Add a few more pantry items and try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the recipe database. Try again in a moment.");
    } finally {
      setFinding(false);
    }
  }

  const cuisines = useMemo(
    () => (recipes ? [...new Set(recipes.map((r) => r.area).filter(Boolean))].sort() : []),
    [recipes],
  );

  const shownRecipes = useMemo(() => {
    if (!recipes) return null;
    let list = recipes;
    if (onlyMakeable) list = list.filter((r) => r.canMake);
    if (cuisine) list = list.filter((r) => r.area === cuisine);
    if (maxBuy !== null) list = list.filter((r) => r.missing.length <= maxBuy);
    const q = recipeQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [recipes, onlyMakeable, cuisine, maxBuy, recipeQuery]);
  const hiddenCount = recipes && onlyMakeable ? recipes.filter((r) => !r.canMake).length : 0;

  async function logRecipe(r: Recipe) {
    if (!handle) return;
    const n = estimateRecipeNutrition(r);
    await logFoodItem(handle.db, handle.uid, today, {
      name: r.title,
      description: `Home recipe${r.area ? ` · ${r.area}` : ""} · est. macros`,
      calories: n.calories, protein_grams: n.protein, carbs_grams: n.carbs, fat_grams: n.fat,
      price: 0, location_id: "pantry", location_name: "Dorm kitchen",
      is_custom: true, funding_source: "personal",
    }).catch(() => {});
    haptic("medium"); flash(`Logged “${r.title}” — edit macros in your journal`);
  }
  async function saveRecipe(r: Recipe) {
    if (!handle) return;
    const n = estimateRecipeNutrition(r);
    await saveInventoryFood(handle.db, handle.uid, {
      name: r.title, calories: n.calories, protein_grams: n.protein, carbs_grams: n.carbs, fat_grams: n.fat,
      serving: "1 serving", source: "recipe",
    }).catch(() => {});
    haptic("light"); flash(`Saved “${r.title}” to My foods ✓`);
  }

  return (
    <div className="flex-1 px-5 pb-8 pt-4">
      {/* Kitchen summary — configured in Profile */}
      <Link href="/profile" className="press mb-4 flex items-center gap-3 rounded-[16px] border border-line bg-surface-2 px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Utensils className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink">{ACCESS_LABEL[access] ?? "Shared kitchen"}</p>
          <p className="truncate text-[11px] text-ink-soft">
            {appliances.length ? appliances.join(" · ") : "No appliances set — tap to set up your kitchen"}
          </p>
        </div>
        <Settings2 className="size-4 shrink-0 text-ink-faint" />
      </Link>

      {/* Pantry inventory */}
      <section className="glass-panel mb-5 rounded-[22px] p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[16px] font-extrabold text-ink">Your pantry</h2>
          {canScan && (
            <button onClick={onScanShelf} className="press flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[11px] font-bold text-accent-contrast">
              <Camera className="size-3.5" /> Scan shelf
            </button>
          )}
        </div>

        {/* Ingredient search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any food — tomato, rice, Rice Krispies…"
            className="w-full rounded-[12px] border border-line bg-surface-2 py-2.5 pl-9 pr-9 text-[13px] text-ink outline-none focus:border-accent"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"><X className="size-4" /></button>
          )}
        </div>

        {/* Search results as image cards */}
        {query.trim().length >= 2 && (
          <div className="mt-2.5">
            {searching && results.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-[12px] text-ink-soft"><Loader2 className="size-3.5 animate-spin" /> Searching foods…</div>
            ) : results.length === 0 ? (
              <p className="py-3 text-[12px] text-ink-soft">No matches — add it manually below.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {results.map((r, i) => (
                  <button key={i} onClick={() => addFromSearch(r)} className="press group relative overflow-hidden rounded-[12px] border border-line bg-surface text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.image} alt="" className="h-16 w-full object-cover" loading="lazy" />
                    <div className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-accent text-accent-contrast shadow"><Plus className="size-3" /></div>
                    <div className="p-1.5">
                      <p className="line-clamp-2 text-[10.5px] font-semibold leading-tight text-ink">{r.name}</p>
                      {r.brand && <p className="truncate text-[9px] text-ink-faint">{r.brand}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manual add */}
        <div className="mt-3 flex gap-2">
          <input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addManual(); }}
            placeholder="…or add by hand"
            className="min-w-0 flex-1 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent"
          />
          <button onClick={addManual} disabled={!manualName.trim()} className="press grid size-9 shrink-0 place-items-center rounded-[10px] bg-accent text-accent-contrast disabled:opacity-50"><Plus className="size-4" /></button>
        </div>

        {/* Inventory grid */}
        {pantry.length === 0 ? (
          <div className="mt-4 py-6 text-center">
            <span className="text-3xl">🧺</span>
            <p className="mt-2 text-[13px] font-semibold text-ink">Your pantry is empty</p>
            <p className="text-[12px] text-ink-soft">Search a food above, scan your shelf, or add by hand.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {pantry.map((it) => (
                <button key={it.id} onClick={() => setEditItem(it)} className="press relative overflow-hidden rounded-[14px] border border-line bg-surface text-left">
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt="" className="h-16 w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-16 w-full place-items-center bg-surface-2 text-2xl">{CAT_EMOJI[it.category ?? "other"] ?? "🍽️"}</div>
                  )}
                  <div className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-ink/55 text-white backdrop-blur"><Pencil className="size-2.5" /></div>
                  <div className="p-1.5">
                    <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-ink">{it.name}</p>
                    {it.quantity && <p className="truncate text-[10px] font-medium text-accent">{it.quantity}</p>}
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-ink-faint">Tap an item to edit its quantity or remove it.</p>
          </>
        )}
      </section>

      {/* Recipe finder */}
      <section className="glass-panel rounded-[22px] p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-[18px] text-accent" />
          <h2 className="font-display text-[16px] font-extrabold text-ink">What can I make?</h2>
        </div>
        <p className="mt-1 text-[12px] text-ink-soft">Real, sourced recipes ranked by your pantry and filtered to your kitchen.</p>
        <button onClick={runFindRecipes} disabled={finding} className="press mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] bg-accent py-3 text-[14px] font-bold text-accent-contrast disabled:opacity-50">
          {finding ? <><Loader2 className="size-4 animate-spin" /> Searching recipes…</> : <><ChefHat className="size-4" /> Find recipes I can make</>}
        </button>

        {error && <p className="mt-3 text-[12px] font-semibold text-danger">{error}</p>}

        {recipes && recipes.length > 0 && (
          <>
            {/* Filters */}
            <div className="mt-4 space-y-2.5">
              {/* Search within results */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
                <input
                  value={recipeQuery}
                  onChange={(e) => setRecipeQuery(e.target.value)}
                  placeholder="Filter recipes — name, cuisine, ingredient…"
                  className="w-full rounded-[12px] border border-line bg-surface-2 py-2 pl-9 pr-9 text-[13px] text-ink outline-none focus:border-accent"
                />
                {recipeQuery && <button onClick={() => setRecipeQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"><X className="size-4" /></button>}
              </div>

              {/* Ready-to-cook toggle */}
              <div className="flex gap-1.5 rounded-[12px] bg-surface-2 p-1">
                {([[true, "Ready to cook"], [false, "Show all"]] as const).map(([v, label]) => (
                  <button key={label} onClick={() => setOnlyMakeable(v)} className={`flex-1 rounded-[9px] py-1.5 text-[12px] font-bold transition ${onlyMakeable === v ? "bg-accent text-accent-contrast" : "text-ink-soft"}`}>{label}</button>
                ))}
              </div>

              {/* Shopping filter */}
              <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1">
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-ink-faint">To buy:</span>
                {([[null, "Any"], [0, "None"], [2, "≤2"], [5, "≤5"]] as const).map(([v, label]) => (
                  <button key={label} onClick={() => setMaxBuy(v)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${maxBuy === v ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"}`}>{label}</button>
                ))}
              </div>

              {/* Cuisine filter */}
              {cuisines.length > 1 && (
                <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
                  <button onClick={() => setCuisine(null)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${!cuisine ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"}`}>All cuisines</button>
                  {cuisines.map((c) => (
                    <button key={c} onClick={() => setCuisine(cuisine === c ? null : c)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${cuisine === c ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-soft"}`}>{c}</button>
                  ))}
                </div>
              )}
            </div>

            {shownRecipes && shownRecipes.length === 0 ? (
              <div className="mt-4 rounded-[14px] border border-dashed border-line-strong bg-surface-2/50 px-4 py-6 text-center">
                <span className="text-2xl">🍳</span>
                <p className="mt-2 text-[13px] font-semibold text-ink">Nothing you can fully cook yet</p>
                <p className="mt-0.5 text-[12px] text-ink-soft">Add appliances in your kitchen setup, or tap “Show all” to see recipes that need more gear.</p>
                {hiddenCount > 0 && (
                  <button onClick={() => setOnlyMakeable(false)} className="press mt-3 rounded-full bg-accent px-4 py-1.5 text-[12px] font-bold text-accent-contrast">Show all {recipes.length}</button>
                )}
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2.5">
                {(shownRecipes ?? []).map((r) => (
                  <button key={r.id} onClick={() => { setOpenRecipe(r); haptic("light"); }} className="press flex items-center gap-3 rounded-[16px] border border-line bg-surface-2 p-2.5 text-left">
                    {r.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={r.image} alt="" className="size-16 shrink-0 rounded-[12px] object-cover" loading="lazy" />
                      : <div className="grid size-16 shrink-0 place-items-center rounded-[12px] bg-accent-soft"><ChefHat className="size-6 text-accent" /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[14px] font-extrabold text-ink">{r.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-soft">{[r.area, r.category].filter(Boolean).join(" · ")}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        {r.canMake
                          ? <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success"><Check className="size-2.5" /> Ready to cook</span>
                          : <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning"><AlertTriangle className="size-2.5" /> Needs {r.requiredMethods.find((m) => m !== "No-cook") ?? "gear"}</span>}
                        <span className="text-[10px] font-semibold text-ink-faint">{r.uses.length} on hand{r.missing.length > 0 ? ` · +${r.missing.length}` : ""}</span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-ink-faint" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {openRecipe && (
        <RecipeSheet recipe={openRecipe} onClose={() => setOpenRecipe(null)} onLog={() => logRecipe(openRecipe)} onSave={() => saveRecipe(openRecipe)} />
      )}
      {editItem && (
        <PantryItemEditor item={editItem} onClose={() => setEditItem(null)} onSave={saveEdit} onDelete={removeEdit} />
      )}
      {toast && (
        <Portal>
          <div className="animate-rise fixed bottom-[100px] left-1/2 z-[120] -translate-x-1/2 rounded-[14px] bg-ink px-4 py-2.5 text-[13px] font-semibold text-surface shadow-[var(--shadow-lg)]">{toast}</div>
        </Portal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recipe detail — instruction-heavy, styled like the app's sheets      */
/* ------------------------------------------------------------------ */

function RecipeSheet({ recipe: r, onClose, onLog, onSave }: {
  recipe: Recipe; onClose: () => void; onLog: () => void; onSave: () => void;
}) {
  const n = estimateRecipeNutrition(r);
  const webSearch = `https://www.google.com/search?q=${encodeURIComponent(`${r.title} recipe`)}`;

  return (
    <Portal>
      <div className="fixed inset-0 z-[110] bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={r.title} className="glass-strong animate-rise fixed inset-x-0 bottom-0 z-[110] mx-auto flex max-w-[480px] flex-col overflow-hidden rounded-t-[28px]" style={{ maxHeight: "92dvh" }}>
        {/* Hero */}
        <div className="relative shrink-0">
          {r.image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={r.image} alt="" className="h-44 w-full object-cover" />
            : <div className="grid h-28 w-full place-items-center bg-accent-soft"><ChefHat className="size-10 text-accent" /></div>}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pt-10">
            <p className="font-display text-[19px] font-extrabold leading-tight text-white">{r.title}</p>
            <p className="mt-0.5 text-[12px] font-semibold text-white/80">{[r.area, r.category].filter(Boolean).join(" · ")}</p>
          </div>
          <button onClick={onClose} className="press absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur"><X className="size-4" /></button>
        </div>

        {/* Scroll body */}
        <div className="thin-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {r.canMake
              ? <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-bold text-success"><Check className="size-3" /> Your kitchen can make this</span>
              : <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-bold text-warning"><AlertTriangle className="size-3" /> Needs gear you didn&apos;t list</span>}
            {r.requiredMethods.filter((m) => m !== "No-cook").map((m) => (
              <span key={m} className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft"><Utensils className="size-3" />{m}</span>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Ingredients</p>
            <ul className="mt-2 divide-y divide-line/60 overflow-hidden rounded-[14px] bg-surface-2">
              {r.ingredients.map((ing, i) => {
                const have = r.uses.includes(ing.name);
                const staple = !have && r.staples.includes(ing.name);
                return (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      {have
                        ? <Check className="size-3.5 shrink-0 text-success" />
                        : staple
                          ? <Minus className="size-3.5 shrink-0 text-ink-faint" />
                          : <Plus className="size-3.5 shrink-0 text-warning" />}
                      <span className={`truncate text-[13px] ${have ? "font-semibold text-ink" : "text-ink-soft"}`}>{ing.name}</span>
                      {staple && <span className="shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-faint">staple</span>}
                    </span>
                    {ing.measure && <span className="shrink-0 text-[12px] font-semibold text-ink-faint">{ing.measure}</span>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 text-[11px] text-ink-soft">
              <span className="font-bold text-success">{r.uses.length}</span> in your pantry
              {r.staples.length > 0 && <> · <span className="font-bold text-ink">{r.staples.length}</span> assumed staples</>}
              {r.missing.length > 0 && <> · <span className="font-bold text-warning">{r.missing.length}</span> to buy</>}
            </p>
            {r.staples.length > 0 && (
              <p className="mt-1 text-[10px] text-ink-faint">Staples (salt, oil, seasonings) are assumed on hand — double-check you actually have them.</p>
            )}
          </div>

          {r.steps.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Step by step</p>
              <ol className="mt-2 space-y-2">
                {r.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 rounded-[14px] bg-surface-2 p-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-extrabold text-accent-contrast">{i + 1}</span>
                    <p className="text-[13.5px] leading-relaxed text-ink">{s}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Stuck? Get help</p>
            <div className="mt-2 flex flex-col gap-2">
              {r.youtube && (
                <a href={r.youtube} target="_blank" rel="noreferrer" className="press flex items-center justify-between rounded-[12px] bg-surface-2 px-3.5 py-2.5">
                  <span className="flex items-center gap-2 text-[13px] font-bold text-ink"><Video className="size-4 text-danger" /> Watch a video tutorial</span>
                  <ExternalLink className="size-3.5 text-ink-faint" />
                </a>
              )}
              {r.source && (
                <a href={r.source} target="_blank" rel="noreferrer" className="press flex items-center justify-between rounded-[12px] bg-surface-2 px-3.5 py-2.5">
                  <span className="flex items-center gap-2 text-[13px] font-bold text-ink"><ExternalLink className="size-4 text-accent" /> Read the full original recipe</span>
                  <ExternalLink className="size-3.5 text-ink-faint" />
                </a>
              )}
              <a href={webSearch} target="_blank" rel="noreferrer" className="press flex items-center justify-between rounded-[12px] bg-surface-2 px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-[13px] font-bold text-ink"><Sparkles className="size-4 text-accent" /> Search the web for tips</span>
                <ExternalLink className="size-3.5 text-ink-faint" />
              </a>
            </div>
          </div>

          <div className="rounded-[12px] border border-line bg-surface-2 p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink"><Flame className="size-3.5 text-flame" /> Rough estimate per serving</p>
            <p className="mt-1 text-[12px] text-ink-soft">~{n.calories} cal · {n.protein}g protein · {n.carbs}g carbs · {n.fat}g fat. This recipe database doesn&apos;t carry exact nutrition — fine-tune it in your journal after logging.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 border-t border-line px-5 pb-[max(env(safe-area-inset-bottom),14px)] pt-3">
          <div className="flex gap-2">
            <button onClick={() => { onLog(); onClose(); }} className="press flex flex-1 items-center justify-center gap-1.5 rounded-[13px] bg-accent py-3 text-[13px] font-bold text-accent-contrast"><Plus className="size-4" /> Log it today</button>
            <button onClick={onSave} className="press flex flex-1 items-center justify-center gap-1.5 rounded-[13px] bg-surface-2 py-3 text-[13px] font-bold text-ink"><Check className="size-4" /> Save to My foods</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* ------------------------------------------------------------------ */
/* Pantry item editor                                                   */
/* ------------------------------------------------------------------ */

function PantryItemEditor({ item, onClose, onSave, onDelete }: {
  item: PantryEntry;
  onClose: () => void;
  onSave: (patch: { name: string; quantity: string; category: string }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? "");
  const [category, setCategory] = useState(item.category ?? "other");

  return (
    <Portal>
      <div className="fixed inset-0 z-[110] bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="glass-strong animate-rise fixed inset-x-0 bottom-0 z-[110] mx-auto w-full max-w-[480px] rounded-t-[28px] px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
        <div className="flex items-center gap-3">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt="" className="size-11 shrink-0 rounded-[12px] object-cover" />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-surface-2 text-xl">{CAT_EMOJI[item.category ?? "other"] ?? "🍽️"}</span>
          )}
          <h3 className="flex-1 font-display text-[16px] font-extrabold text-ink">Edit item</h3>
          <button onClick={onClose} className="press grid size-8 place-items-center rounded-full bg-surface-2 text-ink-soft"><X className="size-4" /></button>
        </div>

        <label className="mt-4 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent" />

        <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">Quantity / portion</label>
        <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 2 cans, half a bag" className="mt-1 w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent" />

        <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">Category</label>
        <div className="no-scrollbar -mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1">
          {PANTRY_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold capitalize transition ${category === c ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-faint"}`}>{c}</button>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onDelete} className="press flex items-center justify-center gap-1.5 rounded-[13px] bg-danger/12 px-4 py-3 text-[13px] font-bold text-danger"><Trash2 className="size-4" /> Remove</button>
          <button onClick={() => onSave({ name, quantity, category })} className="press flex flex-1 items-center justify-center gap-1.5 rounded-[13px] bg-accent py-3 text-[13px] font-bold text-accent-contrast"><Check className="size-4" /> Save</button>
        </div>
      </div>
    </Portal>
  );
}
