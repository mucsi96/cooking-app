import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppHeader, AppHeaderActions, AppMain, LoadingArea, Button, Menu, MenuItem, MenuPopover, MenuTrigger } from '@mucsi96/react-ui';
import { profileQuery } from './api';
import styles from './App.module.css';

const Recipes = lazy(() => import('./recipes/Recipes'));
const RecipeDetail = lazy(() => import('./recipe/RecipeDetail'));
const ImportRecipe = lazy(() => import('./import/ImportRecipe'));
const Settings = lazy(() => import('./settings/Settings'));

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('Az oldal megjelenítése nem sikerült', error); }
  render() {
    return this.state.failed ? <div role="alert"><p>Az oldal betöltése nem sikerült.</p><Button onPress={() => window.location.reload()}>Újrapróbálás</Button></div> : this.props.children;
  }
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useQuery(profileQuery);
  const name = profile.data ? (profile.data.additionalClaims?.name ?? profile.data.preferredUsername ?? profile.data.email).trim() : '';
  useEffect(() => {
    document.title = location.pathname === '/' ? 'Receptek' : location.pathname === '/importalas' ? 'Recept importálása' : location.pathname === '/beallitasok' ? 'Beállítások' : 'Recept';
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return <div className={styles.layout}>
    <AppHeader className={styles.header}>
        <span className={styles.brand}>Szakácskönyv</span>
      <AppHeaderActions>
        <nav aria-label="Fő navigáció" className={styles.navigation}>
          <NavLink to="/" end>Receptek</NavLink>
          <NavLink to="/importalas">Importálás</NavLink>
        </nav>
        <MenuTrigger>
          <Button variant="avatar" aria-label="Felhasználói menü">{name.split(/\s+/).map(part => part[0]).join('').toUpperCase()}</Button>
          <MenuPopover>
            {name && <p className={styles.profile}>{name}</p>}
            {profile.isError && <p role="alert">A profil betöltése nem sikerült.</p>}
            <Menu aria-label="Felhasználói menü">
              <MenuItem onAction={() => navigate('/beallitasok')}>Beállítások</MenuItem>
              {profile.isError && <MenuItem onAction={() => { void profile.refetch(); }}>Újrapróbálás</MenuItem>}
            </Menu>
          </MenuPopover>
        </MenuTrigger>
      </AppHeaderActions>
    </AppHeader>
    <AppMain className={styles.main}>
      <PageBoundary key={location.pathname}>
        <Suspense fallback={<LoadingArea label="Oldal betöltése" fill />}>
          <Routes>
            <Route path="/" element={<Recipes />} />
            <Route path="/recept/:id" element={<RecipeDetail />} />
            <Route path="/importalas" element={<ImportRecipe />} />
            <Route path="/beallitasok" element={<Settings />} />
            <Route path="*" element={<><h1>Az oldal nem található</h1><NavLink to="/">Vissza a receptekhez</NavLink></>} />
          </Routes>
        </Suspense>
      </PageBoundary>
    </AppMain>
  </div>;
}
