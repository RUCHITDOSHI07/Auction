import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { createCloudinaryImageService } from "./cloudinary-core";
import { optimizedImageUrl, type ImageTransformOptions } from "./image-url";

function configuredCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return cloudinary;
}

export async function uploadImage(bytes: Uint8Array, publicId: string, contentType?: string) {
  return createCloudinaryImageService(configuredCloudinary()).uploadImage(bytes, publicId, contentType);
}

export async function replaceImage(bytes: Uint8Array, publicId: string, contentType?: string) {
  return uploadImage(bytes, publicId, contentType);
}

export async function deleteImage(publicId: string) {
  return createCloudinaryImageService(configuredCloudinary()).deleteImage(publicId);
}

export function optimizedDeliveryUrl(sourceUrl: string | undefined, options: ImageTransformOptions) {
  return optimizedImageUrl(sourceUrl, options);
}
