export type ImageTransformOptions = {
  width: number;
  height?: number;
  crop?: "fill" | "fit" | "limit" | "thumb";
  trim?: boolean;
  quality?: "auto" | "auto:good" | "auto:best";
};

export function isCloudinaryImageUrl(sourceUrl: string | undefined): boolean {
  if (!sourceUrl) return false;
  try {
    const url = new URL(sourceUrl);
    return url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.split("/").includes("upload");
  } catch {
    return false;
  }
}

export function isManagedCloudinaryPublicId(
  publicId: string | undefined,
  ownerPublicId?: string,
): publicId is string {
  if (!publicId || !/^pnpl\/(?:players|teams)\/[A-Za-z0-9_-]+$/.test(publicId)) return false;
  return !ownerPublicId || publicId === ownerPublicId || publicId.startsWith(`${ownerPublicId}-`);
}

export function optimizedImageUrl(
  sourceUrl: string | undefined,
  options: ImageTransformOptions,
): string | undefined {
  if (!sourceUrl) return undefined;
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return sourceUrl;
  }
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return sourceUrl;
  const segments = url.pathname.split("/");
  const uploadIndex = segments.indexOf("upload");
  if (uploadIndex < 0) return sourceUrl;
  const transformations = [
    ...(options.trim ? ["e_trim"] : []),
    "f_auto",
    `q_${options.quality ?? "auto:good"}`,
    `w_${Math.max(1, Math.round(options.width))}`,
    ...(options.height ? [`h_${Math.max(1, Math.round(options.height))}`] : []),
    `c_${options.crop ?? (options.height ? "fill" : "limit")}`,
    ...(options.height && (options.crop ?? "fill") === "fill" ? ["g_auto"] : []),
  ].join(",");
  segments.splice(uploadIndex + 1, 0, transformations);
  url.pathname = segments.join("/");
  return url.toString();
}

export function cloudinaryPublicIdFromUrl(
  sourceUrl: string | undefined,
  expectedCloudName?: string,
): string | undefined {
  if (!sourceUrl) return undefined;
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return undefined;
  const segments = url.pathname.split("/");
  if (expectedCloudName && segments[1] !== expectedCloudName) return undefined;
  const uploadIndex = segments.indexOf("upload");
  if (uploadIndex < 0) return undefined;
  const publicIdSegments = segments.slice(uploadIndex + 1).filter(Boolean);
  while (publicIdSegments[0] && (/^v\d+$/.test(publicIdSegments[0]) || /^(?:f_|q_|w_|h_|c_|g_|e_|dpr_|ar_)/.test(publicIdSegments[0]))) {
    publicIdSegments.shift();
  }
  const publicId = publicIdSegments.join("/").replace(/\.[^.]+$/, "");
  return publicId || undefined;
}
