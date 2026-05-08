import { isOwner } from "@/lib/auth";
import { OwnerControlsClient } from "./OwnerControlsClient";

/**
 * Server-component gate. Mounts the interactive owner controls only when
 * the current visitor is the owner — for everyone else the existing
 * read-only StarRating + status pill on the detail page are enough.
 *
 * Drop into any category's detail page; works for board games, video
 * games, and (later) books / movies / series.
 */
export async function OwnerControls({
  internalId,
  rating,
  status,
}: {
  internalId: string;
  rating: number | null;
  status: string[] | null;
}) {
  if (!internalId) return null; // preview mode
  if (!(await isOwner())) return null;
  return (
    <OwnerControlsClient
      internalId={internalId}
      initialRating={rating}
      initialStatuses={status}
    />
  );
}
