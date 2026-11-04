import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { getTeamById, updateTeamImageReference } from "@/lib/services/teams";
import { cloudinaryPublicIdFromUrl, isManagedCloudinaryPublicId } from "@/lib/storage/image-url";
import { deleteImage, uploadImage } from "@/lib/storage/cloudinary";
import { createUniqueImagePublicId } from "@/lib/storage/cloudinary-core";
import { readImageUpload } from "@/lib/storage/image-upload";
import { replacePersistedImage } from "@/lib/storage/image-persistence";
import { ImageValidationError } from "@/lib/storage/image-validation";

type RouteContext = { params: Promise<{ teamId: string }> };

function errorResponse(error: unknown) {
  if (error instanceof AdminApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unable to update team logo." },
    { status: error instanceof ImageValidationError ? 400 : 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { teamId } = await context.params;
    const team = await getTeamById(teamId);
    if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });
    const { bytes, contentType } = await readImageUpload(request);
    const oldPublicIdCandidate = team.cloudinaryPublicId ?? cloudinaryPublicIdFromUrl(team.logoUrl, process.env.CLOUDINARY_CLOUD_NAME);
    const oldPublicId = isManagedCloudinaryPublicId(oldPublicIdCandidate, `pnpl/teams/${teamId}`)
      ? oldPublicIdCandidate
      : undefined;
    let cacheWarning: string | undefined;
    const replacement = await replacePersistedImage({
      previousPublicId: oldPublicId,
      upload: async () => {
        const uploaded = await uploadImage(
          bytes,
          createUniqueImagePublicId(`pnpl/teams/${teamId}`),
          contentType,
        );
        return { photoUrl: uploaded.photoUrl, cloudinaryPublicId: uploaded.cloudinaryPublicId };
      },
      persist: async (image) => {
        const result = await updateTeamImageReference(teamId, {
          logoUrl: image.photoUrl,
          cloudinaryPublicId: image.cloudinaryPublicId,
        });
        cacheWarning = result.warning;
      },
      deleteImage,
    });
    const savedTeam = await getTeamById(teamId);
    const warnings = [
      cacheWarning,
      replacement.cleanupWarning
        ? `Logo was saved, but the previous Cloudinary image could not be deleted: ${replacement.cleanupWarning}`
        : undefined,
    ].filter(Boolean);
    return NextResponse.json({ team: savedTeam, ...(warnings.length ? { warning: warnings.join(" ") } : {}) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { teamId } = await context.params;
    const team = await getTeamById(teamId);
    if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });
    const result = await updateTeamImageReference(teamId, null);
    const oldPublicIdCandidate = team.cloudinaryPublicId ?? cloudinaryPublicIdFromUrl(team.logoUrl, process.env.CLOUDINARY_CLOUD_NAME);
    const oldPublicId = isManagedCloudinaryPublicId(oldPublicIdCandidate, `pnpl/teams/${teamId}`)
      ? oldPublicIdCandidate
      : undefined;
    let warning = result.warning;
    if (oldPublicId) {
      try {
        await deleteImage(oldPublicId);
      } catch (error) {
        warning = [warning, `Logo reference was removed, but the Cloudinary image could not be deleted: ${error instanceof Error ? error.message : "Cloudinary delete failed."}`].filter(Boolean).join(" ");
      }
    }
    return NextResponse.json({ success: true, team: result.team, ...(warning ? { warning } : {}) });
  } catch (error) {
    return errorResponse(error);
  }
}
