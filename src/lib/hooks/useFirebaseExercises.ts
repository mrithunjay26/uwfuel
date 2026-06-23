"use client";

import { useEffect, useState } from "react";
import { get, ref } from "firebase/database";
import { getDiningDb } from "@/lib/firebase/diningApp";
import { resolveBodyPart, type BodyPart } from "@/lib/workout/bodyParts";

export interface FirebaseExercise {
  name: string;
  category: string;
  muscle_group: string;
  body_part: BodyPart;
  secondary_muscles: string[];
  equipment: string;
  difficulty: string;
  description: string;
  instructions: string[];
  image_url: string;
  jefit_url: string;
  source: string;
}

interface UseFirebaseExercisesResult {
  exercises: FirebaseExercise[];
  bySlug: Record<string, FirebaseExercise>;
  loading: boolean;
  error: string | null;
}

interface RawJefitExercise {
  name?: string;
  title?: string;
  description?: string;
  instructions?: string | string[];
  muscleGroups?: string[];
  targetMuscles?: string[];
  otherMuscles?: string[];
  bodyPart?: string;
  mainMuscle?: string;
  equipment?: string;
  difficulty?: string;
  exerciseType?: string;
  workoutType?: string;
  image?: string;
  imageUrl?: string;
  gif?: string;
  sourceUrl?: string;
  error?: string;
}

function toArray(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/\n|•|^\s*\d+\.\s*/m).map((s) => s.trim()).filter(Boolean);
  return [];
}

function mapExercise(raw: RawJefitExercise): FirebaseExercise | null {
  const name = (raw.name || raw.title || "").trim();
  if (!name || raw.error) return null;

  const primaryList =
    Array.isArray(raw.targetMuscles) && raw.targetMuscles.length
      ? raw.targetMuscles
      : Array.isArray(raw.muscleGroups) && raw.muscleGroups.length
        ? raw.muscleGroups
        : [];
  const muscles = [raw.mainMuscle, ...primaryList].filter(Boolean).map((s) => String(s).trim());
  const secondary = Array.isArray(raw.otherMuscles) ? raw.otherMuscles : muscles.slice(1);

  const body_part = resolveBodyPart(
    name,
    [raw.bodyPart, raw.mainMuscle, ...muscles].filter(Boolean) as string[],
  );

  return {
    name,
    category: (raw.exerciseType || raw.workoutType || body_part || "Strength").trim(),
    muscle_group: (muscles[0] || body_part).trim(),
    body_part,
    secondary_muscles: secondary.map((s) => String(s).trim()).filter(Boolean),
    equipment: (raw.equipment || "").trim(),
    difficulty: (raw.difficulty || "").trim(),
    description: (raw.description || "").trim(),
    instructions: toArray(raw.instructions),
    image_url: (raw.image || raw.imageUrl || raw.gif || "").trim(),
    jefit_url: (raw.sourceUrl || "").trim(),
    source: "jefit",
  };
}

export function useFirebaseExercises(): UseFirebaseExercisesResult {
  const [exercises, setExercises] = useState<FirebaseExercise[]>([]);
  const [bySlug, setBySlug] = useState<Record<string, FirebaseExercise>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const db = getDiningDb();
        const flat: FirebaseExercise[] = [];
        const slugMap: Record<string, FirebaseExercise> = {};

        const jefitSnap = await get(ref(db, "jefit/exercises"));
        if (cancelled) return;
        if (jefitSnap.exists()) {
          const map = jefitSnap.val() as Record<string, RawJefitExercise>;
          Object.entries(map).forEach(([key, raw]) => {
            const ex = mapExercise(raw);
            if (ex) { flat.push(ex); slugMap[key] = ex; }
          });
        }

        if (flat.length === 0) {
          const legacy = await get(ref(db, "uw_exercises"));
          if (cancelled) return;
          if (legacy.exists()) {
            const catalog = legacy.val() as Record<string, Record<string, FirebaseExercise>>;
            Object.values(catalog).forEach((catMap) => {
              Object.entries(catMap).forEach(([slug, rawEx]) => {
                const ex: FirebaseExercise = {
                  ...rawEx,
                  body_part: resolveBodyPart(rawEx.name, rawEx.muscle_group),
                };
                flat.push(ex);
                slugMap[slug] = ex;
              });
            });
          }
        }

        if (cancelled) return;
        setExercises(flat);
        setBySlug(slugMap);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load exercises.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { exercises, bySlug, loading, error };
}
