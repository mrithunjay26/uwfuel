"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Barcode, Bookmark, Camera, Check, Combine, Flame, Keyboard, Loader2, MapPin, MessageSquarePlus,
  Minus, Plus, RotateCcw, Search, Sparkles, Trash2, X,
} from "lucide-react";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { useConfig } from "@/lib/config/ConfigContext";
import { useCamera } from "@/lib/hooks/useCamera";
import { useFlatMenu } from "@/lib/hooks/useFlatMenu";
import { useOnboardingProfile } from "@/lib/hooks/useOnboardingProfile";
import { logFoodItem, saveInventoryFood, savePantryItem } from "@/lib/db/userDb";
import { todayPacificKey } from "@/lib/firebase/dining";
import { matchCampusItem } from "@/lib/nutrition/campusMatch";
import { estimateMacros, estimateProteinGrams } from "@/lib/utils/nutrition";
import { scanImage, scanText, scanBarcode, searchFoods, type ScannedFood } from "@/lib/nutrition/scan";
import type { FlatMenuItem } from "@/lib/menu/flattenMenu";
import type { FoodFundingSource } from "@/lib/db/types";
import { Portal } from "@/components/ui/Portal";
import { assessDietarySafety } from "@/lib/dietary/safety";
import { haptic } from "@/lib/utils/haptics";

type Mode = "photo" | "barcode" | "search" | "text";
type Phase = "capture" | "loading" | "results";

interface EditableFood {
  id: string;
  name: string;
  calories: number; protein: number; carbs: number; fat: number; // per single serving
  servings: number;
  qty: string; // free-text quantity, used when adding to the pantry
  servingDescription?: string;
  confidence?: number;
  grounded?: boolean;
  match: FlatMenuItem | null;
  locationName: string;
  locationId: string;
  price: number;
  funding: FoodFundingSource;
  isCustom: boolean;
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

let _uid = 0;
const nextId = () => `f${++_uid}`;

// Always trust the AI's (context-aware) values for ANY food. A campus menu
// match is attached only as an optional suggestion the user can apply — it
// never overrides what was scanned.
function toEditable(food: ScannedFood, menu: FlatMenuItem[]): EditableFood {
  return {
    id: nextId(),
    name: food.name,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    servings: 1,
    qty: food.servingDescription || "",
    servingDescription: food.servingDescription,
    confidence: food.confidence,
    grounded: food.grounded,
    match: matchCampusItem(food.name, menu),
    locationName: food.brand || "Scan",
    locationId: "scan",
    price: 0,
    funding: "unknown",
    isCustom: true,
  };
}

function blankFood(): EditableFood {
  return {
    id: nextId(),
    name: "",
    calories: 0, protein: 0, carbs: 0, fat: 0,
    servings: 1,
    qty: "",
    match: null,
    locationName: "Manual",
    locationId: "manual",
    price: 0,
    funding: "unknown",
    isCustom: true,
  };
}

export function MealScannerSheet({
  open, onClose, onLogged, dateKey, target = "log", onAddedToPantry,
}: {
  open: boolean;
  onClose: () => void;
  onLogged?: (msg: string) => void;
  dateKey?: string;
  /** "log" (default) logs scanned foods to the journal; "pantry" adds them to the dorm pantry. */
  target?: "log" | "pantry";
  onAddedToPantry?: (msg: string) => void;
}) {
  const pantryMode = target === "pantry";
  const handle = useUserDb();
  const { cohereKey, groqKey } = useConfig();
  const day = dateKey ?? todayPacificKey();
  const { items: menu } = useFlatMenu(open);
  const { profile: setupProfile } = useOnboardingProfile();
  const { videoRef, status, start, stop, captureFrame } = useCamera();

  const [mode, setMode] = useState<Mode>("photo");
  const [phase, setPhase] = useState<Phase>("capture");
  const [foods, setFoods] = useState<EditableFood[]>([]);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [lastScan, setLastScan] = useState<{ kind: "image" | "text"; data: string } | null>(null);
  const [logging, setLogging] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ScannedFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);
  const dietaryAssessment = foods.length && setupProfile?.dietary
    ? assessDietarySafety(
        { name: foods.map((food) => food.name).join(", "), ingredients },
        setupProfile.dietary,
      )
    : null;

  // Run the camera only while actively capturing in a camera mode.
  useEffect(() => {
    if (open && phase === "capture" && (mode === "photo" || mode === "barcode")) start();
    else stop();
    return () => { if (!open) stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, phase]);

  // Reset everything when the sheet closes.
  useEffect(() => {
    if (open) return;
    abortRef.current?.abort();
    queueMicrotask(() => {
      setPhase("capture");
      setFoods([]);
      setIngredients([]);
      setError(null);
      setText("");
      setNote("");
      setLastScan(null);
      setSearchQ("");
      setSearchResults([]);
      setSavedIds({});
      setMode("photo");
    });
  }, [open]);

  const runAnalyze = useCallback(
    async (fn: (signal: AbortSignal) => Promise<{ items: ScannedFood[]; ingredients: string[] }>) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setPhase("loading");
      setError(null);
      try {
        const { items, ingredients: ing } = await fn(ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (items.length === 0) {
          setError("No food recognized. Try again, get closer, or type it in.");
          setPhase("capture");
          return;
        }
        setFoods(items.map((f) => toEditable(f, menu)));
        setIngredients(ing);
        setPhase("results");
        haptic("medium");
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setPhase("capture");
      }
    },
    [menu],
  );

  const onShutter = useCallback(() => {
    const frame = captureFrame(1280, 0.85);
    if (!frame) { setError("Camera not ready yet."); return; }
    haptic("light");
    setLastScan({ kind: "image", data: frame });
    const ctx = note.trim() || undefined;
    void runAnalyze((signal) => scanImage(frame, { cohereKey, groqKey, note: ctx }, signal));
  }, [captureFrame, runAnalyze, cohereKey, groqKey, note]);

  const onAnalyzeText = useCallback(() => {
    if (text.trim().length < 2) return;
    setLastScan({ kind: "text", data: text.trim() });
    void runAnalyze((signal) => scanText(text.trim(), { cohereKey, groqKey }, signal));
  }, [text, runAnalyze, cohereKey, groqKey]);

  const onBarcode = useCallback(
    (code: string) => {
      haptic("medium");
      setLastScan(null); // barcode results are exact — not refineable by context
      void runAnalyze(async (signal) => {
        const { item } = await scanBarcode(code, signal);
        return { items: item ? [item] : [], ingredients: [] };
      });
    },
    [runAnalyze],
  );

  // Re-run the same photo/description with the (possibly updated) context note.
  const onRefine = useCallback(() => {
    if (!lastScan) return;
    haptic("light");
    const ctx = note.trim();
    if (lastScan.kind === "image") {
      void runAnalyze((signal) => scanImage(lastScan.data, { cohereKey, groqKey, note: ctx || undefined }, signal));
    } else {
      const combined = ctx ? `${lastScan.data} — ${ctx}` : lastScan.data;
      void runAnalyze((signal) => scanText(combined, { cohereKey, groqKey }, signal));
    }
  }, [lastScan, note, runAnalyze, cohereKey, groqKey]);

  const appendContext = (chip: string) =>
    setNote((prev) => (prev.toLowerCase().includes(chip.toLowerCase()) ? prev : prev.trim() ? `${prev.trim()}, ${chip}` : chip));

  // International food-database search (USDA FDC + Open Food Facts).
  const onSearch = useCallback(() => {
    const q = searchQ.trim();
    if (q.length < 2) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);
    setError(null);
    searchFoods(q, ctrl.signal)
      .then((items) => { if (!ctrl.signal.aborted) setSearchResults(items); })
      .catch((e) => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Search failed."); })
      .finally(() => { if (!ctrl.signal.aborted) setSearching(false); });
  }, [searchQ]);

  const pickSearchResult = (f: ScannedFood) => {
    setFoods((prev) => [...prev, toEditable(f, menu)]);
    setIngredients([]);
    setPhase("results");
    haptic("medium");
  };

  // Save a result food to the reusable inventory ("My foods").
  const saveToInventory = (f: EditableFood) => {
    if (!handle) return;
    haptic("light");
    saveInventoryFood(handle.db, handle.uid, {
      name: f.name || "Food",
      calories: Math.round(f.calories * f.servings),
      protein_grams: Math.round(f.protein * f.servings),
      carbs_grams: Math.round(f.carbs * f.servings),
      fat_grams: Math.round(f.fat * f.servings),
      ...(f.servingDescription ? { serving: f.servingDescription } : {}),
    }).then(() => setSavedIds((m) => ({ ...m, [f.id]: true }))).catch(() => {});
  };

  // Barcode detection while in barcode mode: native BarcodeDetector when
  // available (Android/ChromeOS), else a lazily-loaded ZXing fallback (desktop).
  useEffect(() => {
    if (!open || mode !== "barcode" || phase !== "capture" || status !== "active") return;
    let active = true;
    let intervalId: number | undefined;
    let zxingControls: { stop: () => void } | undefined;

    const hit = (code: string) => {
      if (!active || !code) return;
      active = false;
      if (intervalId) window.clearInterval(intervalId);
      zxingControls?.stop();
      onBarcode(code);
    };

    const Ctor = (window as unknown as { BarcodeDetector?: new (o?: unknown) => BarcodeDetectorLike })
      .BarcodeDetector;

    if (Ctor) {
      const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
      intervalId = window.setInterval(async () => {
        if (!active || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) hit(codes[0].rawValue);
        } catch { /* frame not ready */ }
      }, 600);
    } else {
      // Desktop fallback — decode straight off the live <video> element.
      import("@zxing/browser")
        .then(({ BrowserMultiFormatReader }) => {
          if (!active || !videoRef.current) return;
          const reader = new BrowserMultiFormatReader();
          return reader.decodeFromVideoElement(videoRef.current, (result, _err, controls) => {
            if (!active) { controls.stop(); return; }
            if (result) hit(result.getText());
          });
        })
        .then((controls) => {
          if (controls) zxingControls = !active ? (controls.stop(), undefined) : controls;
        })
        .catch(() => setError("Couldn't start the barcode scanner. Try Photo or Type it."));
    }

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
      zxingControls?.stop();
    };
  }, [open, mode, phase, status, videoRef, onBarcode]);

  const setServings = (id: string, delta: number) =>
    setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, servings: Math.max(0.5, Math.round((f.servings + delta) * 2) / 2) } : f)));
  const editMacro = (id: string, key: "calories" | "protein" | "carbs" | "fat", val: number) =>
    setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: Math.max(0, val) } : f)));
  const setName = (id: string, name: string) =>
    setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  const setQty = (id: string, qty: string) =>
    setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, qty } : f)));
  const setPrice = (id: string, price: number) =>
    setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, price: Math.max(0, price) } : f)));
  const setFunding = (id: string, funding: FoodFundingSource) =>
    setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, funding } : f)));
  const removeFood = (id: string) => setFoods((prev) => prev.filter((f) => f.id !== id));
  const addManualFood = () => setFoods((prev) => [...prev, blankFood()]);

  // Merge every detected item (scaled by its servings) into a single combined food.
  const combineAll = () =>
    setFoods((prev) => {
      if (prev.length < 2) return prev;
      const sum = prev.reduce(
        (a, f) => ({
          calories: a.calories + f.calories * f.servings,
          protein: a.protein + f.protein * f.servings,
          carbs: a.carbs + f.carbs * f.servings,
          fat: a.fat + f.fat * f.servings,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      const names = prev.map((f) => f.name).filter(Boolean);
      const name = names.length <= 2 ? names.join(" + ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
      haptic("medium");
      return [{
        id: nextId(),
        name: name || "Combined meal",
        calories: Math.round(sum.calories),
        protein: Math.round(sum.protein),
        carbs: Math.round(sum.carbs),
        fat: Math.round(sum.fat),
        servings: 1,
        qty: "",
        servingDescription: `${prev.length} items combined`,
        match: null,
        locationName: "Scan",
        locationId: "scan",
        price: prev.reduce((s, f) => s + f.price * f.servings, 0),
        funding: prev.find((f) => f.funding !== "unknown")?.funding ?? "unknown",
        isCustom: true,
      }];
    });

  const mealTotal = foods.reduce(
    (a, f) => ({
      calories: a.calories + f.calories * f.servings,
      protein: a.protein + f.protein * f.servings,
      carbs: a.carbs + f.carbs * f.servings,
      fat: a.fat + f.fat * f.servings,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  // Opt-in: swap in the matched campus item's exact nutrition, price & location.
  const applyCampus = (id: string) =>
    setFoods((prev) =>
      prev.map((f) => {
        if (f.id !== id || !f.match) return f;
        const m = f.match;
        const protein = m.protein_grams > 0 ? m.protein_grams : estimateProteinGrams(m.name, m.description, m.calories);
        const macros = estimateMacros(m.calories, protein);
        return {
          ...f,
          name: m.name,
          calories: Math.round(m.calories),
          protein: Math.round(protein),
          carbs: Math.round((m.carbs_grams ?? 0) > 0 ? (m.carbs_grams as number) : macros.carbs),
          fat: Math.round((m.fat_grams ?? 0) > 0 ? (m.fat_grams as number) : macros.fat),
          locationName: m.location_name,
          locationId: m.location_id,
          price: m.price,
          isCustom: false,
          match: null,
        };
      }),
    );

  const logAll = useCallback(async () => {
    if (!handle) { onLogged?.("Sign in to log meals."); return; }
    if (foods.length === 0) return;
    setLogging(true);
    try {
      for (const f of foods) {
        const m = f.servings;
        await logFoodItem(handle.db, handle.uid, day, {
          name: f.name,
          description: f.servingDescription ? `${f.servingDescription} · scanned` : "Scanned",
          calories: Math.round(f.calories * m),
          protein_grams: Math.round(f.protein * m),
          carbs_grams: Math.round(f.carbs * m),
          fat_grams: Math.round(f.fat * m),
          price: Math.round(f.price * m * 100) / 100,
          location_id: f.locationId,
          location_name: f.locationName,
          is_custom: f.isCustom,
          funding_source: f.funding,
        });
      }
      haptic("medium");
      onLogged?.(`Logged ${foods.length} item${foods.length > 1 ? "s" : ""} ✓`);
      onClose();
    } catch {
      setError("Couldn't log. Check your connection.");
    } finally {
      setLogging(false);
    }
  }, [handle, foods, day, onLogged, onClose]);

  const addAllToPantry = useCallback(async () => {
    if (!handle) { onAddedToPantry?.("Sign in to save your pantry."); return; }
    const items = foods.filter((f) => f.name.trim());
    if (items.length === 0) return;
    setLogging(true);
    try {
      for (const f of items) {
        await savePantryItem(handle.db, handle.uid, {
          name: f.name.trim(),
          ...(f.qty.trim() ? { quantity: f.qty.trim() } : {}),
          category: "other",
        });
      }
      haptic("medium");
      onAddedToPantry?.(`Added ${items.length} to your pantry ✓`);
      onClose();
    } catch {
      setError("Couldn't save. Check your connection.");
    } finally {
      setLogging(false);
    }
  }, [handle, foods, onAddedToPantry, onClose]);

  if (!open) return null;

  const cameraMode = mode === "photo" || mode === "barcode";

  return (
    <Portal>
    <div className="fixed inset-0 z-[80] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-extrabold text-white">
          <Sparkles className="size-4 text-accent" /> {pantryMode ? "Scan your pantry" : "Scan a meal"}
        </h2>
        <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-white/10 text-white">
          <X className="size-5" />
        </button>
      </div>

      {/* Mode switch */}
      <div className="mx-4 mb-3 flex gap-1 rounded-[14px] bg-white/20 p-1">
        {([["photo", "Photo", Camera], ["barcode", "Barcode", Barcode], ["search", "Search", Search], ["text", "Type", Keyboard]] as const).map(
          ([m, label, Icon]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setPhase("capture"); setError(null); haptic("light"); }}
              className={`flex flex-1 items-center justify-center gap-1 rounded-[10px] py-2 text-[11px] font-extrabold transition ${
                mode === m ? "bg-white text-ink shadow-sm" : "text-white"
              }`}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ),
        )}
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* Camera preview */}
        {cameraMode && phase === "capture" && (
          <div className="absolute inset-0">
            <video ref={videoRef} playsInline muted className="size-full object-cover" />
            {mode === "barcode" && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="h-28 w-3/4 rounded-[18px] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                <p className="absolute bottom-[18%] text-[13px] font-semibold text-white/90">Point at a barcode</p>
              </div>
            )}
            {status === "starting" && (
              <div className="absolute inset-0 grid place-items-center text-white/80">
                <Loader2 className="size-6 animate-spin" />
              </div>
            )}
            {(status === "denied" || status === "unsupported") && (
              <div className="absolute inset-0 grid place-items-center px-8 text-center">
                <div>
                  <p className="text-[14px] font-bold text-white">
                    {status === "denied" ? "Camera access blocked" : "Camera unavailable"}
                  </p>
                  <p className="mt-1 text-[12px] text-white/70">Use “Type it” to describe your meal instead.</p>
                  <button onClick={() => { setMode("text"); }} className="press mt-4 rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-accent-contrast">
                    Type it instead
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search mode — international food database (FDC + Open Food Facts) */}
        {mode === "search" && phase === "capture" && (
          <div className="absolute inset-0 flex flex-col bg-bg px-5 py-5">
            <p className="text-[13px] text-ink-soft">Search a worldwide food database — branded &amp; generic foods.</p>
            <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="relative mt-3">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <input
                autoFocus
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="e.g. chicken biryani, oat milk, Clif bar"
                className="w-full rounded-[14px] border border-line bg-surface-2 py-2.5 pl-9 pr-3 text-[14px] text-ink outline-none focus:border-accent"
              />
            </form>
            <button
              onClick={onSearch}
              disabled={searchQ.trim().length < 2 || searching}
              className="press mt-2 rounded-[14px] bg-accent py-2.5 text-[13px] font-bold text-accent-contrast disabled:opacity-50"
            >
              {searching ? "Searching…" : "Search foods"}
            </button>
            <div className="thin-scrollbar mt-3 flex flex-1 flex-col gap-2 overflow-y-auto">
              {searchResults.map((f, i) => (
                <button
                  key={i}
                  onClick={() => pickSearchResult(f)}
                  className="glass-panel flex items-center gap-3 rounded-[14px] p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-ink">{f.name}{f.brand ? <span className="text-ink-faint"> · {f.brand}</span> : null}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-soft">
                      <span className="flex items-center gap-0.5"><Flame className="size-3 text-flame" />{Math.round(f.calories)}</span>
                      <span>{Math.round(f.protein)}g P</span>
                      {f.servingDescription && <span className="truncate text-ink-faint">· {f.servingDescription}</span>}
                    </p>
                  </div>
                  <Plus className="size-4 shrink-0 text-accent" />
                </button>
              ))}
              {!searching && searchQ.trim().length >= 2 && searchResults.length === 0 && (
                <p className="py-6 text-center text-[12px] text-ink-soft">No matches. Try the Type-it mode to estimate it.</p>
              )}
            </div>
          </div>
        )}

        {/* Text mode */}
        {mode === "text" && phase === "capture" && (
          <div className="absolute inset-0 flex flex-col gap-3 bg-bg px-5 py-5">
            <p className="text-[13px] text-ink-soft">Describe what you ate and we’ll estimate the nutrition.</p>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={400}
              placeholder="e.g. grilled chicken bowl with rice, black beans, and salsa"
              className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-[14px] text-ink outline-none focus:border-accent"
            />
            <button
              onClick={onAnalyzeText}
              disabled={text.trim().length < 2}
              className="press rounded-[14px] bg-accent py-3 text-[14px] font-bold text-accent-contrast disabled:opacity-50"
            >
              Analyze
            </button>
          </div>
        )}

        {/* Loading */}
        {phase === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-bg">
            <div className="text-center">
              <Loader2 className="mx-auto size-7 animate-spin text-accent" />
              <p className="mt-3 text-[13px] font-semibold text-ink-soft">Reading your meal…</p>
            </div>
          </div>
        )}

        {/* Results editor */}
        {phase === "results" && (
          <div className="thin-scrollbar absolute inset-0 overflow-y-auto bg-bg px-4 py-4">
            <div className="flex flex-col gap-3">
              {pantryMode && foods.length > 0 && (
                <div className="rounded-[16px] bg-accent-soft px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-accent-ink">Found {foods.length} item{foods.length > 1 ? "s" : ""}</p>
                  <p className="mt-0.5 text-[12px] text-ink-soft">Review names &amp; quantities, then add them to your pantry. You can fine-tune portions anytime.</p>
                </div>
              )}
              {!pantryMode && foods.length > 0 && (
                <div className="rounded-[16px] bg-accent-soft px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-accent-ink">
                      Meal total{foods.length > 1 ? ` · ${foods.length} items` : ""}
                    </span>
                    <span className="font-display text-[20px] font-extrabold text-ink">{Math.round(mealTotal.calories)}<span className="text-[11px] font-bold text-ink-faint"> kcal</span></span>
                  </div>
                  <div className="mt-1 flex gap-3 text-[12px] font-semibold text-ink-soft">
                    <span className="text-protein">{Math.round(mealTotal.protein)}g P</span>
                    <span className="text-carbs">{Math.round(mealTotal.carbs)}g C</span>
                    <span className="text-fat">{Math.round(mealTotal.fat)}g F</span>
                  </div>
                  {foods.length > 1 && (
                    <button
                      onClick={combineAll}
                      className="press mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-accent py-2 text-[12px] font-bold text-accent-contrast"
                    >
                      <Combine className="size-3.5" /> Combine into one item
                    </button>
                  )}
                </div>
              )}
              {!pantryMode && dietaryAssessment?.status === "blocked" && (
                <div role="alert" className="rounded-[16px] border border-danger/30 bg-danger/10 px-4 py-3">
                  <p className="flex items-center gap-2 text-[12px] font-bold text-danger">
                    <AlertTriangle className="size-4 shrink-0" /> Dietary conflict detected
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                    {dietaryAssessment.reasons.join(" · ")}. You can still log this meal so your history stays accurate.
                  </p>
                </div>
              )}
              {!pantryMode && dietaryAssessment?.status === "unknown" && (
                <div role="status" className="rounded-[16px] border border-line bg-surface-2 px-4 py-3">
                  <p className="flex items-center gap-2 text-[12px] font-bold text-ink">
                    <AlertTriangle className="size-4 shrink-0 text-ink-faint" /> Dietary status unverified
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                    Check the ingredients before eating. Logging remains available for accurate tracking.
                  </p>
                </div>
              )}
              {lastScan && (
                <div className="glass-panel rounded-[18px] p-3.5">
                  <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
                    <MessageSquarePlus className="size-3.5 text-accent" /> Add context &amp; refine
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">
                    Missed an item or portion off? Add a detail and re-scan.
                  </p>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={160}
                    placeholder="e.g. add a side of fries, this is a large bowl"
                    className="mt-2 w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["Larger portion", "Smaller portion", "Add a side", "No oil/butter", "Extra sauce", "Half eaten"].map((chip) => (
                      <button
                        key={chip}
                        onClick={() => appendContext(chip)}
                        className="press rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft active:bg-surface-3"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={onRefine}
                    disabled={!note.trim()}
                    className="press mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-accent py-2 text-[12px] font-bold text-accent-contrast disabled:opacity-50"
                  >
                    <Sparkles className="size-3.5" /> Refine with this context
                  </button>
                </div>
              )}
              {foods.map((f) => {
                if (pantryMode) {
                  return (
                    <div key={f.id} className="glass-panel flex items-center gap-2 rounded-[16px] p-3">
                      <div className="min-w-0 flex-1">
                        <input
                          value={f.name}
                          onChange={(e) => setName(f.id, e.target.value)}
                          placeholder="Item name"
                          className="w-full bg-transparent font-display text-[14px] font-extrabold text-ink outline-none placeholder:text-ink-faint"
                        />
                        <input
                          value={f.qty}
                          onChange={(e) => setQty(f.id, e.target.value)}
                          placeholder="Quantity (optional) — e.g. 2 cans, half a bag"
                          className="mt-0.5 w-full bg-transparent text-[12px] text-ink-soft outline-none placeholder:text-ink-faint"
                        />
                      </div>
                      <button onClick={() => removeFood(f.id)} aria-label="Remove" className="grid size-7 shrink-0 place-items-center rounded-full text-ink-faint hover:text-danger"><Trash2 className="size-3.5" /></button>
                    </div>
                  );
                }
                const m = f.servings;
                return (
                  <div key={f.id} className="glass-panel rounded-[18px] p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <input
                          value={f.name}
                          onChange={(e) => setName(f.id, e.target.value)}
                          placeholder="Food name"
                          className="w-full truncate bg-transparent font-display text-[15px] font-extrabold text-ink outline-none placeholder:text-ink-faint"
                        />
                        <p className="mt-0.5 text-[11px] text-ink-faint">
                          {f.isCustom ? (f.servingDescription || "Estimated") : f.locationName}
                          {!f.isCustom && f.price > 0 ? ` · $${f.price.toFixed(2)}` : ""}
                          {f.grounded ? " · USDA" : ""}
                          {f.confidence != null && f.confidence < 0.5 ? " · low confidence — tap to edit" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => saveToInventory(f)}
                          aria-label="Save to My foods"
                          title="Save to My foods"
                          className={`grid size-7 place-items-center rounded-full ${savedIds[f.id] ? "text-accent" : "text-ink-faint hover:text-accent"}`}
                        >
                          <Bookmark className={`size-3.5 ${savedIds[f.id] ? "fill-accent" : ""}`} />
                        </button>
                        <button onClick={() => removeFood(f.id)} className="grid size-7 place-items-center rounded-full text-ink-faint hover:text-danger">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {f.match && (
                      <button
                        onClick={() => applyCampus(f.id)}
                        className="press mt-2 flex w-full items-center gap-1.5 rounded-[10px] bg-accent-soft px-2.5 py-1.5 text-left text-[11px] font-semibold text-accent-ink"
                      >
                        <MapPin className="size-3 shrink-0" />
                        <span className="flex-1 truncate">
                          Also at {f.match.location_name}{f.match.price > 0 ? ` · $${f.match.price.toFixed(2)}` : ""} — use exact campus nutrition
                        </span>
                      </button>
                    )}

                    {/* Servings */}
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Servings</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setServings(f.id, -0.5)} className="press grid size-7 place-items-center rounded-full bg-surface-2 text-ink"><Minus className="size-3.5" /></button>
                        <span className="w-9 text-center text-[14px] font-bold text-ink">{m}</span>
                        <button onClick={() => setServings(f.id, +0.5)} className="press grid size-7 place-items-center rounded-full bg-surface-2 text-ink"><Plus className="size-3.5" /></button>
                      </div>
                    </div>

                    {/* Editable macros (per serving) */}
                    <div className="mt-2.5 grid grid-cols-4 gap-2">
                      {([["calories", "kcal", "text-flame"], ["protein", "P", "text-protein"], ["carbs", "C", "text-carbs"], ["fat", "F", "text-fat"]] as const).map(
                        ([key, label, color]) => (
                          <label key={key} className="rounded-[12px] bg-surface-2 px-2 py-1.5 text-center">
                            <input
                              type="number"
                              inputMode="numeric"
                              value={f[key]}
                              onChange={(e) => editMacro(f.id, key, Math.round(Number(e.target.value) || 0))}
                              className={`w-full bg-transparent text-center font-display text-[15px] font-extrabold outline-none ${color}`}
                            />
                            <span className="block text-[9px] font-bold uppercase text-ink-faint">{label}</span>
                          </label>
                        ),
                      )}
                    </div>
                    {m !== 1 && (
                      <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-ink-soft">
                        <Flame className="size-3 text-flame" /> {Math.round(f.calories * m)} kcal total · {Math.round(f.protein * m)}g protein
                      </p>
                    )}

                    {/* Price & how it was paid — same fields the journal shows */}
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                        Price
                        <div className="mt-1 flex items-center rounded-[10px] border border-line bg-surface-2 px-2.5">
                          <span className="text-[13px] text-ink-faint">$</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.01}
                            value={f.price || ""}
                            onChange={(e) => setPrice(f.id, Number(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full bg-transparent py-2 pl-1 text-[13px] font-semibold text-ink outline-none"
                          />
                        </div>
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                        Paid with
                        <select
                          value={f.funding}
                          onChange={(e) => setFunding(f.id, e.target.value as FoodFundingSource)}
                          className="mt-1 w-full rounded-[10px] border border-line bg-surface-2 px-2.5 py-2 text-[13px] normal-case text-ink outline-none"
                        >
                          <option value="unknown">Not tracked</option>
                          <option value="dining_plan">Dining Plan</option>
                          <option value="husky_card">Husky Card</option>
                          <option value="personal">Personal</option>
                        </select>
                      </label>
                    </div>
                  </div>
                );
              })}

              {!pantryMode && ingredients.length > 0 && (
                <div className="glass-panel rounded-[16px] p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Ingredients</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ingredients.map((ing) => (
                      <span key={ing} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">{ing}</span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={addManualFood}
                className="press flex items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-accent/40 py-2.5 text-[13px] font-bold text-accent-ink"
              >
                <Plus className="size-3.5" /> Add an item manually
              </button>
              <button
                onClick={() => { setPhase("capture"); setFoods([]); setIngredients([]); setError(null); }}
                className="press flex items-center justify-center gap-1.5 rounded-[14px] bg-surface-2 py-2.5 text-[13px] font-bold text-ink-soft"
              >
                <RotateCcw className="size-3.5" /> Scan again
              </button>
              <div className="h-24" />
            </div>
          </div>
        )}

        {/* Error toast */}
        {error && phase !== "results" && (
          <div className="absolute inset-x-4 bottom-28 rounded-[12px] bg-ink/90 px-4 py-2.5 text-center text-[12px] font-semibold text-surface">
            {error}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {cameraMode && phase === "capture" && mode === "photo" && (
        <div className="flex flex-col items-center gap-3 px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">
          <div className="flex w-full items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 backdrop-blur-md">
            <MessageSquarePlus className="size-4 shrink-0 text-white/70" />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={160}
              placeholder="Add context — portion size, no oil, whole plate…"
              className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/50"
            />
            {note && (
              <button onClick={() => setNote("")} aria-label="Clear context" className="shrink-0 text-white/60">
                <X className="size-4" />
              </button>
            )}
          </div>
          <button
            onClick={onShutter}
            disabled={status !== "active"}
            aria-label="Capture"
            className="press grid size-[68px] place-items-center rounded-full bg-white disabled:opacity-40"
          >
            <span className="size-14 rounded-full ring-4 ring-ink/20" />
          </button>
          <p className="text-[11px] text-white/55">Frame the whole plate · tap to scan everything</p>
        </div>
      )}

      {phase === "results" && (
        <div className="px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
          <button
            onClick={pantryMode ? addAllToPantry : logAll}
            disabled={logging || foods.length === 0}
            className="press flex w-full items-center justify-center gap-2 rounded-[16px] bg-accent py-3.5 text-[15px] font-bold text-accent-contrast disabled:opacity-60"
          >
            {logging
              ? <><Check className="size-4" /> {pantryMode ? "Adding…" : "Logging…"}</>
              : <><Plus className="size-4" strokeWidth={2.5} /> {pantryMode ? "Add" : "Log"} {foods.length} item{foods.length > 1 ? "s" : ""}{pantryMode ? " to pantry" : ""}</>}
          </button>
        </div>
      )}
    </div>
    </Portal>
  );
}
