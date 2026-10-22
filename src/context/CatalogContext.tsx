/* eslint-disable react/only-export-components -- context hooks are colocated with their providers on purpose */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { catalogApi } from '../services/api';
import type { CategoryInfo, Command, CommandLight, CTFDomainInfo } from '../types';
import { useAuth } from './AuthContext';

/**
 * Catalog data lives on the backend and is auth-gated (Part 1). Signed-in
 * sessions load the light index once; full docs are fetched per slug on
 * demand. Memory only — nothing durable, and everything is dropped on sign-out
 * and account switch so data never crosses users.
 */

type LightIndex = CommandLight[];

interface CatalogValue {
  /** Index payload state: loading until the first successful fetch post-auth, error surfaces for retry. */
  loading: boolean;
  error: string | null;
  categories: CategoryInfo[];
  domains: CTFDomainInfo[];
  /** Per-category counts for the sidebar (id → number, both sections). */
  counts: Record<string, number>;
  lights: LightIndex;
  /** Maps for O(1) path resolution + lookup (populated from categories/domains). */
  categoryMap: Map<string, CategoryInfo>;
  domainMap: Map<string, CTFDomainInfo>;
  /**
   * Full docs for one slug — served from the in-memory cache when already
   * fetched, otherwise a single in-flight request per slug.
   */
  getCommand: (slug: string) => Promise<Command>;
  /** Promise-coalescing bulk variant for pages that need many docs (flashcard decks, cheat sheets, drills). */
  getDocs: (slugs: string[]) => Promise<Command[]>;
  /** All 132 docs (already-ordered payloads), coalesced into one request wave. */
  getAll: () => Promise<Command[]>;
  clearError: () => void;
}

const EMPTY: CatalogValue = {
  loading: false,
  error: null,
  categories: [],
  domains: [],
  counts: {},
  lights: [],
  categoryMap: new Map(),
  domainMap: new Map(),
  getCommand: async () => { throw new Error('catalog not ready'); },
  getDocs: async () => { throw new Error('catalog not ready'); },
  getAll: async () => { throw new Error('catalog not ready'); },
  clearError: () => {},
};

const CatalogContext = createContext<CatalogValue>(EMPTY);

export const CatalogProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [domains, setDomains] = useState<CTFDomainInfo[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [lights, setLights] = useState<LightIndex>([]);

  /** In-memory-only doc cache + inflight map, reset on every identity switch. */
  const docCacheRef = useRef(new Map<string, Command>());
  const inflightRef = useRef(new Map<string, Promise<Command>>());
  const allDocsRef = useRef<Promise<Command[]> | null>(null);
  /** Marks the catalog fetch as belonging to a specific user id (throw-away on switch). */
  const fetchSeqRef = useRef(0);

  const reset = useCallback(() => {
    fetchSeqRef.current += 1;
    docCacheRef.current = new Map();
    inflightRef.current = new Map();
    allDocsRef.current = null;
    setCategories([]);
    setDomains([]);
    setCounts({});
    setLights([]);
    setError(null);
    setLoading(true);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      reset();
      setLoading(false);
      return;
    }
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);
    catalogApi.index()
      .then((data) => {
        if (seq !== fetchSeqRef.current) return; // stale (logout / account switch)
        docCacheRef.current = new Map();
        allDocsRef.current = null;
        setCategories(data.categories);
        setDomains(data.domains);
        setCounts(data.counts);
        setLights(data.commands);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (seq !== fetchSeqRef.current) return;
        setError(err.message || 'Could not load the command index.');
        setLoading(false);
      });
    return () => { void seq; };
    // Re-fetch whenever the signed-in identity changes, not on every user object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, reset]);

  const categoryMap = useMemo(
    () => new Map(categories.map((cat) => [cat.id, cat])),
    [categories],
  );
  const domainMap = useMemo(
    () => new Map(domains.map((dom) => [dom.id, dom])),
    [domains],
  );

  const getCommand = useCallback(async (slug: string): Promise<Command> => {
    const cached = docCacheRef.current.get(slug);
    if (cached) return cached;
    const inflight = inflightRef.current.get(slug);
    if (inflight) return inflight;
    const request = catalogApi.command(slug)
      .then((data) => {
        docCacheRef.current.set(slug, data.command);
        inflightRef.current.delete(slug);
        return data.command;
      })
      .catch((err: Error) => {
        inflightRef.current.delete(slug);
        throw err;
      });
    inflightRef.current.set(slug, request);
    return request;
  }, []);

  const getDocs = useCallback(async (slugs: string[]): Promise<Command[]> => {
    const unique = Array.from(new Set(slugs));
    const settled = await Promise.all(unique.map((slug) => getCommand(slug)));
    return settled;
  }, [getCommand]);

  const getAll = useCallback(async (): Promise<Command[]> => {
    // Fast path: one fetch wave already completed and every slug sits in cache.
    if (lights.length > 0 && lights.every((light) => docCacheRef.current.has(light.slug)) && allDocsRef.current) {
      return allDocsRef.current;
    }
    allDocsRef.current = getDocs(lights.map((light) => light.slug));
    return allDocsRef.current;
  }, [getDocs, lights]);

  const value = useMemo<CatalogValue>(() => ({
    loading,
    error,
    categories,
    domains,
    counts,
    lights,
    categoryMap,
    domainMap,
    getCommand,
    getDocs,
    getAll,
    clearError: () => setError(null),
  }), [loading, error, categories, domains, counts, lights, categoryMap, domainMap, getCommand, getDocs, getAll]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export const useCatalog = () => useContext(CatalogContext);

/* ------------------------------------------------- shared data-loading hooks */

/** Categories/domains in a stable shape every consumer can rely on. */
export const useCatalogIndex = () => {
  const { categories, domains, counts, loading, error, clearError, domainMap } = useCatalog();
  return { categories, domains, counts, loading, error, clearError, domainMap };
};

/** Full docs for a fixed slug: {command|undefined, loading, error, retry}. */
export function useCommandDoc(slug: string | undefined) {
  const { getCommand, lights } = useCatalog();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ command: Command | null; loading: boolean; error: string | null }>(
    { command: null, loading: true, error: null },
  );
  useEffect(() => {
    let alive = true;
    if (!slug) {
      setState({ command: null, loading: false, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getCommand(slug)
      .then((command) => alive && setState({ command, loading: false, error: null }))
      .catch((err: Error) => alive && setState({ command: null, loading: false, error: err.message }));
    return () => { alive = false; };
  }, [slug, getCommand, lights, attempt]);
  return { ...state, retry: () => setAttempt((a) => a + 1) };
}

/** Full docs for the given slugs (stable by string value): {docs, loading, error}. */
export function useCommandDocs(slugs: string[]) {
  const key = useMemo(() => [...slugs].sort().join('|'), [slugs]);
  const { getDocs } = useCatalog();
  const [state, setState] = useState<{ docs: Command[]; loading: boolean; error: string | null }>(
    { docs: [], loading: true, error: null },
  );
  useEffect(() => {
    let alive = true;
    if (!slugs.length) {
      setState({ docs: [], loading: false, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getDocs(slugs)
      .then((docs) => {
        if (!alive) return;
        setState((prev) => ({ ...prev, docs, loading: false, error: null }));
      })
      .catch((err: Error) => alive && setState({ docs: [], loading: false, error: err.message }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, getDocs]);
  return state;
}

/** The full dataset as docs (slow on first load, instant afterwards). */
export function useAllCommands() {
  const { getAll, lights } = useCatalog();
  const [docs, setDocs] = useState<Command[]>([]);
  const [loading, setLoading] = useState(lights.length > 0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!lights.length) {
      setDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getAll()
      .then((found) => alive && (setDocs(found), setLoading(false)))
      .catch((err: Error) => alive && (setError(err.message), setLoading(false)));
    return () => { alive = false; };
  }, [getAll, lights]);
  return { commands: docs, loading, error };
}

export const getPathForCommand = (command: Pick<Command, 'section' | 'category' | 'slug'>) =>
  command.section === 'linux' ? `/linux/${command.category}/${command.slug}` : `/ctf/${command.category}/${command.slug}`;

export const getPathForLight = (light: Pick<CommandLight, 'section' | 'category' | 'slug'>) =>
  light.section === 'linux' ? `/linux/${light.category}/${light.slug}` : `/ctf/${light.category}/${light.slug}`;
