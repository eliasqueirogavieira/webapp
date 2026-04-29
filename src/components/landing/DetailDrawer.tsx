"use client";

import Image from "next/image";
import Link from "next/link";
import { Drawer, Button } from "@heroui/react";
import { ExternalLink, X } from "lucide-react";
import type { ItemCardData } from "@/components/ItemCard";
import { RatingBadge } from "@/components/RatingBadge";

const SLUG_TO_PATH: Record<ItemCardData["category"], string> = {
  boardgame: "/boardgames",
  videogame: "/videogames",
  movie: "/movies",
  series: "/series",
  restaurant: "/restaurants",
};

export function DetailDrawer({
  section,
  item,
  onClose,
}: {
  section: string | null;
  item: ItemCardData | null;
  onClose: () => void;
}) {
  const open = item !== null;
  const vtName = item && section ? `cover-${section}-${item.id}` : undefined;

  return (
    <Drawer
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Drawer.Backdrop className="bg-black/50 backdrop-blur-sm">
        <Drawer.Content placement="right">
          <Drawer.Dialog className="flex h-full w-full max-w-md flex-col bg-[var(--background)] shadow-2xl">
            <Drawer.Header className="flex items-center justify-between border-b border-[var(--border)]/60 px-5 py-4">
              <Drawer.Heading className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {item?.category === "boardgame" ? "Board game" : "Video game"}
              </Drawer.Heading>
              <Drawer.CloseTrigger className="rounded-full p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
                <X size={18} />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body className="flex-1 overflow-y-auto p-0">
              {item && (
                <div className="flex flex-col">
                  <div
                    className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--surface-hover)]"
                    style={{ viewTransitionName: vtName }}
                  >
                    {item.cover_url ? (
                      <Image
                        src={item.cover_url}
                        alt={item.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 28rem"
                        priority
                        className="object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-sm text-[var(--muted)]">
                        sem capa
                      </div>
                    )}
                    {/* OKLCH glow at the bottom */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
                      style={{
                        background:
                          "linear-gradient(to top, var(--background), transparent)",
                      }}
                    />
                  </div>
                  <div className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-2xl font-semibold tracking-tight">
                          {item.title}
                        </h3>
                        {item.year && (
                          <div className="mt-1 text-sm text-[var(--muted)]">
                            {item.year}
                          </div>
                        )}
                      </div>
                      {item.rating !== null && (
                        <RatingBadge rating={item.rating} size="md" />
                      )}
                    </div>
                    <div className="mt-6 flex flex-col gap-2">
                      <Link
                        href={`${SLUG_TO_PATH[item.category]}/${item.id}`}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--landing-ink)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                      >
                        Ver detalhes completos <ExternalLink size={14} />
                      </Link>
                      <Button
                        variant="secondary"
                        onPress={onClose}
                        className="h-11 rounded-full text-sm"
                      >
                        Fechar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
