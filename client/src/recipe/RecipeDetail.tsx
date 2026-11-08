import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge, LoadingArea, Button } from '@mucsi96/react-ui';
import { recipeQuery, type Recipe } from '../api';
import { RecipeImage } from '../components/RecipeImage';
import { LoadError } from '../components/LoadError';
import { ImageDialog } from './ImageDialog';
import { EditDialog } from './EditDialog';
import styles from './RecipeDetail.module.css';

const formatter = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 2 });

export default function RecipeDetail() {
  const { id } = useParams();
  if (!id) throw new Error('Missing recipe ID');
  const recipe = useQuery(recipeQuery(id));
  if (recipe.isError) return <LoadError message="A recept betöltése nem sikerült." retry={() => { void recipe.refetch(); }} />;
  if (recipe.isPending) return <LoadingArea label="Recept betöltése" fill />;
  return <RecipeArticle key={id} recipe={recipe.data} />;
}

function RecipeArticle({ recipe }: { recipe: Recipe }) {
  const [servingsOverride, setServings] = useState<number>();
  const servings = servingsOverride ?? recipe.servings;
  const [dialog, setDialog] = useState<'image' | 'edit' | null>(null);
  return <article className={styles.article}>
    <button type="button" className={styles.hero} aria-label="Borítókép módosítása" aria-haspopup="dialog" onClick={() => setDialog('image')}>
      <RecipeImage imageId={recipe.imageId} alt={recipe.title} /><span>Borítókép módosítása</span>
    </button>
    <div className={styles.heading}><h1>{recipe.title}</h1><Badge>{recipe.category}</Badge><div className={styles.actions}>
      <Button variant="outlined" onPress={() => setDialog('edit')}>Recept szerkesztése</Button>
      <Button variant="outlined" onPress={() => window.print()}>Nyomtatás</Button>
    </div></div>
    <p className={styles.description}>{recipe.description}</p>
    <section aria-label="Adagok" className={styles.servings}>
      <Button variant="icon" aria-label="Adagok csökkentése" isDisabled={servings <= 1} onPress={() => setServings(servings - 1)}>−</Button>
      <span>{servings} adag</span>
      <Button variant="icon" aria-label="Adagok növelése" onPress={() => setServings(servings + 1)}>+</Button>
    </section>
    <section aria-label="Hozzávalók"><h2>Hozzávalók</h2><ul className={styles.ingredients}>{recipe.ingredients.map((ingredient, index) =>
      <li key={index}>{ingredient.amount !== null && <span>{formatter.format(ingredient.amount * servings / recipe.servings)} {ingredient.unit}</span>}<span>{ingredient.name}</span></li>)}</ul></section>
    <section aria-label="Elkészítés"><h2>Elkészítés</h2><ol className={styles.steps}>{recipe.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></section>
    {dialog === 'image' && <ImageDialog recipe={recipe} onClose={() => setDialog(null)} />}
    {dialog === 'edit' && <EditDialog recipe={recipe} onClose={() => setDialog(null)} onSaved={() => { setServings(undefined); setDialog(null); }} />}
  </article>;
}
