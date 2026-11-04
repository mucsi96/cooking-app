import { useQuery } from '@tanstack/react-query';
import { BarLoader, Card } from '@mucsi96/react-ui';
import { Link } from 'react-router-dom';
import { categories, recipesQuery } from '../api';
import { LoadError } from '../components/LoadError';
import { RecipeImage } from '../components/RecipeImage';
import styles from './Recipes.module.css';

export default function Recipes() {
  const recipes = useQuery(recipesQuery);
  if (recipes.isError) return <LoadError message="A receptek betöltése nem sikerült." retry={() => { void recipes.refetch(); }} />;
  if (recipes.isPending) return <BarLoader label="Receptek betöltése" />;
  if (!recipes.data.length) return <div className={styles.empty}><h1>Még nincs egyetlen recept sem</h1><p>Kezdd az első recept importálásával!</p><Link to="/importalas">Recept importálása</Link></div>;
  const present = [...new Set(recipes.data.map(recipe => recipe.category))];
  const ordered = [...categories.filter(category => present.includes(category)), ...present.filter(category => !categories.some(known => known === category)).sort((a, b) => a.localeCompare(b, 'hu'))];
  return ordered.map(category => <section key={category}>
    <h2>{category}</h2>
    <div className={styles.grid}>{recipes.data.filter(recipe => recipe.category === category).sort((a, b) => a.title.localeCompare(b.title, 'hu')).map(recipe =>
      <Link key={recipe.id} to={`/recept/${recipe.id}`} aria-label={recipe.title} className={styles.link}>
        <Card className={styles.card}><div className={styles.thumbnail}><RecipeImage imageId={recipe.imageId} alt={recipe.title} /></div><h3>{recipe.title}</h3></Card>
      </Link>)}</div>
  </section>);
}
