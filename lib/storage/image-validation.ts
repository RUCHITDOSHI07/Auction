export const maximumImageBytes = 10 * 1024 * 1024;

export type SupportedImageFormat = "jpeg" | "png" | "webp" | "gif" | "avif";

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

const mimeTypes: Record<SupportedImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export function detectImageFormat(bytes: Uint8Array): SupportedImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  if (bytes.length >= 6) {
    const signature = String.fromCharCode(...bytes.slice(0, 6));
    if (signature === "GIF87a" || signature === "GIF89a") return "gif";
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (brand === "avif" || brand === "avis") return "avif";
  }
  return null;
}

export function validateImageBytes(
  bytes: Uint8Array,
  contentType?: string,
  maxBytes = maximumImageBytes,
): SupportedImageFormat {
  if (bytes.byteLength === 0) throw new ImageValidationError("Image file is empty.");
  if (bytes.byteLength > maxBytes) throw new ImageValidationError("Image exceeds the maximum permitted size.");
  const format = detectImageFormat(bytes);
  if (!format) throw new ImageValidationError("File content is not a supported image. Use JPEG, PNG, WebP, GIF, or AVIF.");
  if (contentType) {
    const normalizedContentType = contentType.split(";")[0].trim().toLowerCase();
    if (normalizedContentType !== mimeTypes[format]) throw new ImageValidationError("Image content type does not match the file data.");
  }
  return format;
}
