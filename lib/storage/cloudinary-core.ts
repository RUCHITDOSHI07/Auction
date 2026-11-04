import { randomUUID } from "node:crypto";
import { validateImageBytes } from "./image-validation.ts";

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
};

export type CloudinaryClient = {
  uploader: {
    upload(source: string, options: Record<string, unknown>): Promise<CloudinaryUploadResult>;
    destroy(publicId: string, options: Record<string, unknown>): Promise<{ result: string }>;
  };
};

export function createUniqueImagePublicId(ownerPublicId: string): string {
  if (!/^pnpl\/(?:players|teams)\/[A-Za-z0-9_-]+$/.test(ownerPublicId)) {
    throw new Error("Cloudinary image ID must use the PNPL player or team namespace.");
  }
  return `${ownerPublicId}-${randomUUID()}`;
}

export function createCloudinaryImageService(client: CloudinaryClient) {
  return {
    async uploadImage(bytes: Uint8Array, publicId: string, contentType?: string) {
      const format = validateImageBytes(bytes, contentType);
      if (!/^pnpl\/(?:players|teams)\/[A-Za-z0-9_-]+$/.test(publicId)) {
        throw new Error("Cloudinary image ID must use the PNPL player or team namespace.");
      }
      const result = await client.uploader.upload(
        `data:image/${format};base64,${Buffer.from(bytes).toString("base64")}`,
        {
          public_id: publicId,
          overwrite: false,
          invalidate: true,
          unique_filename: false,
          use_filename: false,
          resource_type: "image",
        },
      );
      if (!result.secure_url || result.public_id !== publicId) {
        throw new Error("Cloudinary returned an incomplete image upload result.");
      }
      return { photoUrl: result.secure_url, cloudinaryPublicId: result.public_id };
    },
    async deleteImage(publicId: string) {
      if (!/^pnpl\/(?:players|teams)\/[A-Za-z0-9_-]+$/.test(publicId)) {
        throw new Error("Cloudinary image ID must use the PNPL player or team namespace.");
      }
      const result = await client.uploader.destroy(publicId, { invalidate: true, resource_type: "image" });
      if (result.result !== "ok" && result.result !== "not found") {
        throw new Error(`Cloudinary did not delete image ${publicId}.`);
      }
    },
  };
}
