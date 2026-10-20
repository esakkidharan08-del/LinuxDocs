/* eslint-disable react/only-export-components -- context hooks are colocated with their providers on purpose */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { commandsApi } from '../services/api';
import type { CategoryInfo, Command, CTFDomainInfo } from '../types';
import { useAuth } from './AuthContext';

type Catalog = { commands: Command[]; categories: CategoryInfo[]; domains: CTFDomainInfo[]; loading: boolean; error: string | null };
const CatalogContext = createContext<Catalog>({ commands: [], categories: [], domains: [], loading: true, error: null });

export const CatalogProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [catalog, setCatalog] = useState<Catalog>({ commands: [], categories: [], domains: [], loading: true, error: null });
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setCatalog({ commands: [], categories: [], domains: [], loading: false, error: null }); return; }
    setCatalog((current) => ({ ...current, loading: true }));
    commandsApi.list().then((data) => setCatalog({ ...data, loading: false, error: null })).catch((error: Error) => setCatalog((current) => ({ ...current, loading: false, error: error.message })));
  }, [user, authLoading]);
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
};

export const useCatalog = () => useContext(CatalogContext);
export const getPathForCommand = (command: Command) => command.section === 'linux' ? `/linux/${command.category}/${command.slug}` : `/ctf/${command.category}/${command.slug}`;
