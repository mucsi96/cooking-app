import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '../api';
import styles from './RecipeImage.module.css';

export function RecipeImage({ imageId, alt }: { imageId: string | null; alt: string }) {
  const image = useQuery({
    queryKey: ['image', imageId], enabled: !!imageId, staleTime: Infinity,
    queryFn: async ({ signal }) => (await request(`/api/images/${encodeURIComponent(imageId!)}`, { signal })).blob(),
  });
  return image.data ? <BlobImage key={imageId} blob={image.data} alt={alt} /> : <div className={styles.placeholder} role="img" aria-label={alt}><span aria-hidden="true">♨</span></div>;
}

function BlobImage({ blob, alt }: { blob: Blob; alt: string }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    if (image.current) image.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return <img ref={image} className={styles.image} alt={alt} />;
}
