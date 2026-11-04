export type UploadedImageReference = {
  photoUrl: string;
  cloudinaryPublicId: string;
};

export async function replacePersistedImage<T>(
  options: {
    previousPublicId?: string;
    upload: () => Promise<UploadedImageReference>;
    persist: (image: UploadedImageReference) => Promise<T>;
    deleteImage: (publicId: string) => Promise<void>;
  },
) {
  const uploaded = await options.upload();
  let saved: T;
  try {
    saved = await options.persist(uploaded);
  } catch (error) {
    if (uploaded.cloudinaryPublicId !== options.previousPublicId) {
      try {
        await options.deleteImage(uploaded.cloudinaryPublicId);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Image reference could not be saved and the uploaded image could not be cleaned up.");
      }
    }
    throw error;
  }

  let cleanupWarning: string | undefined;
  if (options.previousPublicId && options.previousPublicId !== uploaded.cloudinaryPublicId) {
    try {
      await options.deleteImage(options.previousPublicId);
    } catch (error) {
      cleanupWarning = error instanceof Error ? error.message : "Previous Cloudinary image could not be deleted.";
    }
  }
  return { saved, uploaded, cleanupWarning };
}
