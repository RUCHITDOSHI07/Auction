"use client";

import { useState } from "react";

type PlayerPortraitProps = {
  name: string;
  initials: string;
  photoUrl?: string;
  className: string;
};

export default function PlayerPortrait({ name, initials, photoUrl, className }: PlayerPortraitProps) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const showPhoto = Boolean(photoUrl && photoUrl !== failedPhotoUrl);

  return (
    <div className={className} role="img" aria-label={`${name} portrait`}>
      {showPhoto
        ? <img
            src={photoUrl}
            alt=""
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={() => setFailedPhotoUrl(photoUrl ?? null)}
          />
        : <span aria-hidden="true">{initials}</span>}
    </div>
  );
}