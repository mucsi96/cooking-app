import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, TextField } from '@mucsi96/react-ui';
import { useNavigate } from 'react-router-dom';
import { mutate, photoBody, recipeQuery, recipeSchema, recipesQuery } from '../api';
import { PhotoPicker } from '../components/PhotoPicker';
import styles from './ImportRecipe.module.css';

export default function ImportRecipe() {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const navigate = useNavigate();
  const client = useQueryClient();
  const importing = useMutation({
    mutationFn: async (source: string | File) => recipeSchema.parse(await (await mutate(
      source instanceof File ? '/api/recipes/import/image' : '/api/recipes/import', 'POST',
      source instanceof File ? photoBody(source) : { text: source },
    )).json()),
    onSuccess: async recipe => {
      client.setQueryData(recipeQuery(recipe.id).queryKey, recipe);
      await client.invalidateQueries({ queryKey: recipesQuery.queryKey });
      void navigate(`/recept/${recipe.id}`);
    },
  });
  return <div className={styles.page}>
    <header><p>Új recept</p><h1>Hogyan adnád hozzá?</h1><p>Fotózd le a receptet, válassz egy korábbi képet, vagy illeszd be a szövegét vagy webcímét. Az eredményt magyarul mentjük el.</p></header>
    <section aria-labelledby="photo-title">
      <h2 id="photo-title">Recept felismerése fotóról</h2>
      <PhotoPicker kind="recipe" file={photo} onChange={file => { setPhoto(file); importing.reset(); }} disabled={importing.isPending} />
      {photo && <Button isDisabled={importing.isPending} onPress={() => importing.mutate(photo)}>Recept felismerése</Button>}
    </section>
    <p className={styles.divider}>vagy</p>
    <section aria-labelledby="text-title">
      <h2 id="text-title">Beillesztés szövegből vagy hivatkozásból</h2>
      <TextField label="Recept szövege vagy webcíme" multiline rows={10} value={text} onChange={setText} isDisabled={importing.isPending} placeholder="Illeszd be a recept szövegét bármilyen nyelven, vagy a https:// kezdetű webcímét..." />
      <Button isDisabled={!text.trim() || importing.isPending} onPress={() => importing.mutate(text)}>Importálás</Button>
    </section>
    {importing.isPending && <p role="status">A recept feldolgozása folyamatban van...</p>}
    {importing.isError && <p role="alert">{importing.variables instanceof File ? 'A recept felismerése nem sikerült. Készíts élesebb fotót, és próbáld újra.' : 'A recept feldolgozása nem sikerült. Ellenőrizd a hivatkozást, vagy másold be a recept szövegét, és próbáld újra.'}</p>}
  </div>;
}
