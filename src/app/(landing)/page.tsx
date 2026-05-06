import { getHomeStats, getWishlist } from "@/lib/data";
import { ENABLED_CATEGORIES } from "@/lib/categories";
import { LandingHome, type LandingSection } from "@/components/landing/LandingHome";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [{ byCategory, recentPlays }, wishlist] = await Promise.all([
    getHomeStats(),
    getWishlist(8),
  ]);

  // Strip non-serializable fields (lucide icon component) before crossing the
  // server → client boundary.
  const sections: LandingSection[] = ENABLED_CATEGORIES.flatMap((c) => {
    const stats = byCategory[c.enum];
    if (!stats) return [];
    return [
      {
        enum: c.enum,
        label: c.label,
        highlightLabel: c.highlightLabel,
        count: stats.count,
        avg: stats.avg,
        top: stats.top,
        highlight: stats.highlight,
        recent: stats.recent,
      },
    ];
  });

  const totalItems = sections.reduce((sum, s) => sum + s.count, 0);

  return (
    <LandingHome
      sections={sections}
      totalItems={totalItems}
      recentPlays={recentPlays}
      wishlist={wishlist}
    />
  );
}
