"use client";

import { useState } from "react";
import { optimizedImageUrl } from "@/lib/storage/image-url";

type PlayerPortraitProps = {
  name: string;
  initials: string;
  photoUrl?: string;
  className: string;
};

export default function PlayerPortrait({ name, initials, photoUrl, className }: PlayerPortraitProps) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const showPhoto = Boolean(photoUrl && photoUrl !== failedPhotoUrl);
  const imageUrl = optimizedImageUrl(photoUrl, { width: 900, height: 900 });

  return (
    <div className={className} role="img" aria-label={`${name} portrait`}>
      {showPhoto
        ? <img
            src={imageUrl}
            alt=""
            width="900"
            height="900"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={() => setFailedPhotoUrl(photoUrl ?? null)}
          />
        : <span aria-hidden="true">{initials}</span>}
    </div>
  );
}