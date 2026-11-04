import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Select, TextField } from '@mucsi96/react-ui';
import { categories, mutate, recipeQuery, recipesQuery, type Ingredient, type Recipe, type RecipeContent } from '../api';
import { AutoTextarea, NumberField } from '../components/Fields';
import { Modal } from '../components/Modal';
import styles from './EditDialog.module.css';

export function EditDialog({ recipe, onClose, onSaved }: { recipe: Recipe; onClose: () => void; onSaved: () => void }) {
  const [content, setContent] = useState<RecipeContent>(() => ({ title: recipe.title, description: recipe.description, category: recipe.category, servings: recipe.servings, ingredients: recipe.ingredients, steps: recipe.steps }));
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => mutate(`/api/recipes/${recipe.id}`, 'PUT', content),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: recipeQuery(recipe.id).queryKey }), client.invalidateQueries({ queryKey: recipesQuery.queryKey })]);
      onSaved();
    },
  });
  const update = (patch: Partial<RecipeContent>) => setContent(current => ({ ...current, ...patch }));
  const ingredient = (index: number, patch: Partial<Ingredient>) => update({ ingredients: content.ingredients.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const valid = content.title.trim() && content.description.trim() && Number.isInteger(content.servings) && content.servings >= 1 && content.servings <= 2147483647
    && content.ingredients.length && content.ingredients.every(item => item.name.trim() && (item.amount === null || Number.isFinite(item.amount) && item.amount >= 0 && item.amount <= 99999999.99))
    && content.steps.length && content.steps.every(step => step.trim());
  return <Modal title="Recept szerkesztése" busy={save.isPending} onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); if (valid && !save.isPending) save.mutate(); }}>
      {save.isError && <p role="alert">A mentés nem sikerült. Ellenőrizd az adatokat, és próbáld újra.</p>}
      <fieldset disabled={save.isPending} className={styles.fields}>
        <TextField label="Recept neve" isRequired value={content.title} onChange={title => update({ title })} isDisabled={save.isPending} />
        <AutoTextarea label="Leírás" value={content.description} onChange={description => update({ description })} disabled={save.isPending} />
        <div className={styles.row}>
          <Select label="Kategória" options={categories.map(id => ({ id, label: id }))} selectedKey={content.category} onSelectionChange={key => { if (key !== null) update({ category: String(key) }); }} isDisabled={save.isPending} />
          <NumberField label="Alapadagok száma" required min={1} max={2147483647} step={1} value={Number.isNaN(content.servings) ? '' : content.servings} onChange={event => update({ servings: event.target.valueAsNumber })} />
        </div>
        <h3>Hozzávalók</h3>
        {content.ingredients.map((item, index) => <div className={styles.item} key={index}>
          <TextField label={`Hozzávaló ${index + 1} neve`} isRequired value={item.name} onChange={name => ingredient(index, { name })} isDisabled={save.isPending} />
          <div className={styles.row}>
            <NumberField label={`Mennyiség ${index + 1}`} min={0} max={99999999.99} step={0.01} value={item.amount ?? ''} onChange={event => ingredient(index, { amount: event.target.value === '' ? null : event.target.valueAsNumber })} />
            <TextField label={`Mértékegység ${index + 1}`} value={item.unit ?? ''} onChange={unit => ingredient(index, { unit: unit || null })} isDisabled={save.isPending} />
          </div>
          <Button variant="outlined" isDisabled={save.isPending || content.ingredients.length <= 1} onPress={() => update({ ingredients: content.ingredients.filter((_, i) => i !== index) })}>Hozzávaló {index + 1} törlése</Button>
        </div>)}
        <Button variant="outlined" isDisabled={save.isPending} onPress={() => update({ ingredients: [...content.ingredients, { name: '', amount: null, unit: null }] })}>Hozzávaló hozzáadása</Button>
        <h3>Elkészítés</h3>
        {content.steps.map((step, index) => <div className={styles.item} key={index}>
          <AutoTextarea label={`Elkészítés ${index + 1}. lépése`} value={step} onChange={value => update({ steps: content.steps.map((item, i) => i === index ? value : item) })} disabled={save.isPending} />
          <Button variant="outlined" isDisabled={save.isPending || content.steps.length <= 1} onPress={() => update({ steps: content.steps.filter((_, i) => i !== index) })}>{index + 1}. lépés törlése</Button>
        </div>)}
        <Button variant="outlined" isDisabled={save.isPending} onPress={() => update({ steps: [...content.steps, ''] })}>Lépés hozzáadása</Button>
      </fieldset>
      <div className={styles.actions}><Button variant="text" onPress={onClose} isDisabled={save.isPending}>Mégse</Button><Button type="submit" isDisabled={!valid || save.isPending}>{save.isPending ? 'Mentés…' : 'Mentés'}</Button></div>
    </form>
  </Modal>;
}
