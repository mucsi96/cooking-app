import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingArea, Button, Card, Select } from '@mucsi96/react-ui';
import { catalogQuery, mutate, settingsQuery, settingsSchema, type Catalog, type Settings as ModelSettings } from '../api';
import { NumberField } from '../components/Fields';
import { LoadError } from '../components/LoadError';
import styles from './Settings.module.css';

export default function Settings() {
  const catalog = useQuery(catalogQuery);
  const settings = useQuery(settingsQuery);
  return <div className={styles.page}><Link to="/">Vissza a receptekhez</Link><h1>Beállítások</h1>
    {catalog.isError || settings.isError ? <LoadError message="A modellbeállítások betöltése nem sikerült." retry={() => { void catalog.refetch(); void settings.refetch(); }} />
      : catalog.isPending || settings.isPending ? <LoadingArea label="Modellbeállítások betöltése" /> : <SettingsForm catalog={catalog.data} initial={settings.data} />}
  </div>;
}

function SettingsForm({ catalog, initial }: { catalog: Catalog; initial: ModelSettings }) {
  const [draft, setDraft] = useState(initial);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => mutate('/api/settings/models', 'PUT', settingsSchema.parse(draft)),
    onSuccess: () => { client.setQueryData(settingsQuery.queryKey, draft); },
  });
  function update(value: ModelSettings) { setDraft(value); save.reset(); }
  const options = catalog.data.map(model => ({ id: model.id, label: model.id }));
  return <form onSubmit={event => { event.preventDefault(); if (settingsSchema.safeParse(draft).success && !save.isPending) save.mutate(); }}>
    <p>A beállítások minden felhasználóra érvényesek. A már sorban álló képek modellje nem változik.</p>
    <Card className={styles.card}><h2>Adatmodellek</h2>
      <Select label="Recept felismerése" options={options} selectedKey={draft.extraction} onSelectionChange={key => { if (key !== null) update({ ...draft, extraction: String(key) }); }} isDisabled={save.isPending} />
      <Select label="Képleírás készítése" options={options} selectedKey={draft.scene} onSelectionChange={key => { if (key !== null) update({ ...draft, scene: String(key) }); }} isDisabled={save.isPending} />
    </Card>
    <Card className={styles.card}><h2>Képmodellek</h2><p>Borítóképek száma feltöltött ételfotónként. A 0 kikapcsolja a modellt. Modellenként legfeljebb 10, összesen legfeljebb 30 kép kérhető.</p>
      {catalog.images.map(model => {
        const count = draft.images.find(image => image.id === model.id)?.count ?? 0;
        return <div className={styles.imageRow} key={model.id}><span>{model.name}</span><NumberField label="Képek száma" aria-label={`${model.name} képek száma`} min={0} max={10} step={1} value={Number.isNaN(count) ? '' : count} disabled={save.isPending} onChange={event => update({ ...draft, images: [...draft.images.filter(image => image.id !== model.id), { id: model.id, count: event.target.valueAsNumber }] })} /></div>;
      })}
    </Card>
    <Button type="submit" isDisabled={!settingsSchema.safeParse(draft).success || save.isPending}>{save.isPending ? 'Mentés…' : 'Mentés'}</Button>
    {save.isError && <p role="alert">A mentés nem sikerült. Próbáld újra.</p>}
    <p role="status">{save.isSuccess ? 'A beállításokat mentettük.' : ''}</p>
  </form>;
}
