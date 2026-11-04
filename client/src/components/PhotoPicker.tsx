import { useEffect, useRef, useState } from 'react';
import { Button } from '@mucsi96/react-ui';
import styles from './PhotoPicker.module.css';

export function PhotoPicker({ file, onChange, disabled, kind }: {
  file: File | null; onChange: (file: File | null) => void; disabled: boolean; kind: 'recipe' | 'food';
}) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  function select(input: HTMLInputElement) {
    const photo = input.files?.[0];
    input.value = '';
    if (!photo || disabled) return;
    onChange(null);
    if (!photo.type.startsWith('image/') && !/\.(heic|heif)$/i.test(photo.name)) {
      setError(kind === 'recipe' ? 'Válassz egy fényképet a receptről.' : 'Válassz egy fényképet az ételről.');
    } else if (photo.size > 15 * 1024 * 1024) {
      setError('A fénykép legfeljebb 15 MB lehet.');
    } else { setError(''); onChange(photo); }
  }
  return <>
    <div className={styles.actions}>
      <Button variant="outlined" onPress={() => camera.current?.click()} isDisabled={disabled}>Fotó készítése</Button>
      <Button variant="outlined" onPress={() => gallery.current?.click()} isDisabled={disabled}>Kiválasztás a Fotókból</Button>
    </div>
    <input ref={camera} className={styles.file} type="file" accept="image/*" capture="environment" aria-label={kind === 'recipe' ? 'Recept lefotózása' : 'Étel lefotózása'} disabled={disabled} onChange={event => select(event.currentTarget)} />
    <input ref={gallery} className={styles.file} type="file" accept="image/*" aria-label={kind === 'recipe' ? 'Receptfotó kiválasztása' : 'Ételfotó kiválasztása'} disabled={disabled} onChange={event => select(event.currentTarget)} />
    {file && <div className={styles.preview}><Preview file={file} alt={kind === 'recipe' ? 'Kiválasztott receptfotó' : 'Kiválasztott ételfotó'} /><p>{file.name}</p><Button variant="text" onPress={() => { onChange(null); setError(''); }} isDisabled={disabled}>Fotó eltávolítása</Button></div>}
    {error && <p role="alert">{error}</p>}
  </>;
}

function Preview({ file, alt }: { file: File; alt: string }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={image} alt={alt} />;
}
