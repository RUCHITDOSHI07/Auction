import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { getPlayerById, removePlayerImage, updatePlayerImageReference } from "@/lib/services/players";
import { cloudinaryPublicIdFromUrl, isManagedCloudinaryPublicId } from "@/lib/storage/image-url";
import { deleteImage, uploadImage } from "@/lib/storage/cloudinary";
import { createUniqueImagePublicId } from "@/lib/storage/cloudinary-core";
import { readImageUpload } from "@/lib/storage/image-upload";
import { replacePersistedImage } from "@/lib/storage/image-persistence";
import { ImageValidationError } from "@/lib/storage/image-validation";

type RouteContext = { params: Promise<{ playerId: string }> };

function errorResponse(error: unknown) {
  if (error instanceof AdminApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unable to update player image." },
    { status: error instanceof ImageValidationError ? 400 : 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { playerId } = await context.params;
    const player = await getPlayerById(playerId);
    if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    const { bytes, contentType } = await readImageUpload(request);
    const oldPublicIdCandidate = player.cloudinaryPublicId ?? cloudinaryPublicIdFromUrl(player.photoUrl, process.env.CLOUDINARY_CLOUD_NAME);
    const oldPublicId = isManagedCloudinaryPublicId(oldPublicIdCandidate, `pnpl/players/${playerId}`)
      ? oldPublicIdCandidate
      : undefined;
    let cacheWarning: string | undefined;
    const replacement = await replacePersistedImage({
      previousPublicId: oldPublicId,
      upload: () => uploadImage(
        bytes,
        createUniqueImagePublicId(`pnpl/players/${playerId}`),
        contentType,
      ),
      persist: async (image) => {
        const result = await updatePlayerImageReference(playerId, image);
        cacheWarning = result.warning;
      },
      deleteImage,
    });
    const savedPlayer = await getPlayerById(playerId);
    const warnings = [
      cacheWarning,
      replacement.cleanupWarning
        ? `Photo was saved, but the previous Cloudinary image could not be deleted: ${replacement.cleanupWarning}`
        : undefined,
    ].filter(Boolean);
    return NextResponse.json({ player: savedPlayer, ...(warnings.length ? { warning: warnings.join(" ") } : {}) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { playerId } = await context.params;
    const player = await getPlayerById(playerId);
    if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    let warning = await removePlayerImage(playerId);
    const oldPublicIdCandidate = player.cloudinaryPublicId ?? cloudinaryPublicIdFromUrl(player.photoUrl, process.env.CLOUDINARY_CLOUD_NAME);
    const oldPublicId = isManagedCloudinaryPublicId(oldPublicIdCandidate, `pnpl/players/${playerId}`)
      ? oldPublicIdCandidate
      : undefined;
    if (oldPublicId) {
      try {
        await deleteImage(oldPublicId);
      } catch (error) {
        warning = [warning, `Photo reference was removed, but the Cloudinary image could not be deleted: ${error instanceof Error ? error.message : "Cloudinary delete failed."}`].filter(Boolean).join(" ");
      }
    }
    return NextResponse.json({ success: true, ...(warning ? { warning } : {}) });
  } catch (error) {
    return errorResponse(error);
  }
}
