import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarLoader, Button } from '@mucsi96/react-ui';
import { ApiError, candidatesSchema, imagesQuery, mutate, photoBody, recipeQuery, recipesQuery, type Recipe } from '../api';
import { PhotoPicker } from '../components/PhotoPicker';
import { RecipeImage } from '../components/RecipeImage';
import { LoadError } from '../components/LoadError';
import { Modal } from '../components/Modal';
import styles from './ImageDialog.module.css';

export function ImageDialog({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const client = useQueryClient();
  const candidates = useQuery({ ...imagesQuery(recipe.id), refetchInterval: query => query.state.data?.some(candidate => candidate.status === 'PENDING') ? 1000 : false });
  const upload = useMutation({
    mutationFn: async (file: File) => candidatesSchema.parse(await (await mutate(`/api/recipes/${recipe.id}/images`, 'POST', photoBody(file))).json()),
    onSuccess: async () => { setPhoto(null); await client.invalidateQueries({ queryKey: imagesQuery(recipe.id).queryKey }); },
  });
  const select = useMutation({
    mutationFn: (imageId: string) => mutate(`/api/recipes/${recipe.id}/image`, 'PUT', { imageId }),
    onSuccess: async (_, imageId) => {
      client.setQueryData(recipeQuery(recipe.id).queryKey, { ...recipe, imageId });
      await Promise.all([client.invalidateQueries({ queryKey: recipeQuery(recipe.id).queryKey }), client.invalidateQueries({ queryKey: recipesQuery.queryKey })]);
    },
  });
  const busy = upload.isPending || select.isPending;
  return <Modal title="Borítókép" busy={busy} onClose={onClose}>
    <p>Fotózd le az ételt, vagy válassz egy képet a Fotókból. A fényképed alapján AI-borítóképeket készítünk, amelyekből kiválaszthatod a kedvencedet.</p>
    <PhotoPicker kind="food" file={photo} onChange={file => { setPhoto(file); upload.reset(); }} disabled={busy} />
    {upload.isError && <p role="alert">{upload.error instanceof ApiError ? upload.error.message : 'A fénykép feltöltése nem sikerült. Próbáld újra.'}</p>}
    {select.isError && <p role="alert">A borítókép kiválasztása nem sikerült. Próbáld újra.</p>}
    {candidates.isError ? <LoadError message="A képek betöltése nem sikerült." retry={() => { void candidates.refetch(); }} /> : candidates.isPending ? <BarLoader label="Képek betöltése" /> :
      <div className={styles.candidates}>{candidates.data.map(candidate => candidate.status === 'COMPLETED'
        ? <button type="button" key={candidate.id} className={styles.candidate} aria-label={`Kép kiválasztása ${candidate.id}`} aria-pressed={candidate.id === recipe.imageId} disabled={busy} onClick={() => select.mutate(candidate.id)}><RecipeImage imageId={candidate.id} alt="Generált képjelölt" /></button>
        : candidate.status === 'PENDING' ? <div key={candidate.id} className={styles.pending} role="status" aria-label="Kép generálása folyamatban"><BarLoader label="Kép generálása" /></div> : <p key={candidate.id} role="status">A kép elkészítése nem sikerült.</p>)}
        {!candidates.data.length && <p>Még nincs választható kép. Adj hozzá egy fotót az ételről.</p>}
      </div>}
    {upload.isPending && <p role="status">Fénykép feltöltése…</p>}
    {select.isPending && <p role="status">Borítókép mentése…</p>}
    <Button isDisabled={!photo || busy} onPress={() => { if (photo) upload.mutate(photo); }}>Borítóképek készítése fotóból</Button>
  </Modal>;
}
