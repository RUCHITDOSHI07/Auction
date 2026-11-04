import { ImageValidationError, maximumImageBytes, validateImageBytes } from "./image-validation";

const maximumRequestBytes = maximumImageBytes + 256 * 1024;

export async function readImageUpload(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
    throw new ImageValidationError("Image upload must be 10 MB or smaller.");
  }
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob)) throw new ImageValidationError("Select an image file to upload.");
  if (file.size > maximumImageBytes) throw new ImageValidationError("Image upload must be 10 MB or smaller.");
  const contentType = file.type.split(";")[0].trim().toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());
  validateImageBytes(bytes, contentType);
  return { bytes, contentType };
}
