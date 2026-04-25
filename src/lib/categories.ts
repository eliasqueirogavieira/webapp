/**
 * Single source of truth for the categories the app supports.
 * Adding a new category = appending one entry here + creating a thin route
 * wrapper at `src/app/(app)/<slug>/page.tsx`.
 *
 * The schema's `media_category` enum defines what's storage-valid; only
 * categories registered here show up in nav, hero, and home sections.
 */
import { Dice5, Gamepad2, Film, Tv, Utensils, type LucideIcon } from "lucide-react";

export type CategoryEnum = "boardgame" | "videogame" | "movie" | "series" | "restaurant";

export type CategoryConfig = {
  /** DB enum value (matches items.category). */
  enum: CategoryEnum;
  /** URL slug — stable. /<slug>, /<slug>/[id], /<slug>/[id]/* */
  slug: string;
  /** Sidebar / nav label, properly cased. */
  label: string;
  /** Singular noun used in the count line ("82 jogo" / "82 jogos"). */
  countNoun: { singular: string; plural: string };
  /** Lucide icon for nav + hero CTA. */
  icon: LucideIcon;
  /** Order in nav / hero (low first). */
  order: number;
  /** Whether to surface this category in the user-facing nav today.
   *  Future categories (movies, series, restaurants) flip to true once their
   *  detail page exists. */
  enabled: boolean;
  /** Whether the detail page renders the plays panel. */
  hasPlays: boolean;
};

export const CATEGORIES: CategoryConfig[] = [
  {
    enum: "boardgame",
    slug: "boardgames",
    label: "Board games",
    countNoun: { singular: "jogo", plural: "jogos" },
    icon: Dice5,
    order: 1,
    enabled: true,
    hasPlays: true,
  },
  {
    enum: "videogame",
    slug: "videogames",
    label: "Video games",
    countNoun: { singular: "jogo", plural: "jogos" },
    icon: Gamepad2,
    order: 2,
    enabled: true,
    hasPlays: false,
  },
  {
    enum: "movie",
    slug: "movies",
    label: "Filmes",
    countNoun: { singular: "filme", plural: "filmes" },
    icon: Film,
    order: 3,
    enabled: false,
    hasPlays: false,
  },
  {
    enum: "series",
    slug: "series",
    label: "Séries",
    countNoun: { singular: "série", plural: "séries" },
    icon: Tv,
    order: 4,
    enabled: false,
    hasPlays: false,
  },
  {
    enum: "restaurant",
    slug: "restaurants",
    label: "Restaurantes",
    countNoun: { singular: "restaurante", plural: "restaurantes" },
    icon: Utensils,
    order: 5,
    enabled: false,
    hasPlays: false,
  },
];

/** Categories shown in user-facing nav, in display order. */
export const ENABLED_CATEGORIES = CATEGORIES.filter((c) => c.enabled).sort(
  (a, b) => a.order - b.order,
);

export function getCategoryByEnum(value: CategoryEnum): CategoryConfig {
  const c = CATEGORIES.find((x) => x.enum === value);
  if (!c) throw new Error(`Unknown category enum: ${value}`);
  return c;
}

export function getCategoryBySlug(slug: string): CategoryConfig | null {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}
