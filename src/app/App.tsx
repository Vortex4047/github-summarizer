import { useCallback, useEffect, useMemo, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Header } from './components/Header';
import { ImpactMetrics } from './components/ImpactMetrics';
import { ContributionHeatmap } from './components/ContributionHeatmap';
import { TechStack } from './components/TechStack';
import { TopRepositories } from './components/TopRepositories';
import { ActivityStream } from './components/ActivityStream';
import { ScrollReveal } from './components/ScrollReveal';
import { DashboardControls, type HeatmapMode, type RepoSort } from './components/DashboardControls';
import { ActivityLab } from './components/ActivityLab';
import { DeveloperCompare } from './components/DeveloperCompare';
import { FunDock } from './components/FunDock';
import { CommandPalette, type CommandItem } from './components/CommandPalette';
import { fetchGitHubDashboardData, type GitHubDashboardData } from './github';

type ThemeVariant = 'cyber' | 'holo' | 'quantum';

const THEMES: ThemeVariant[] = ['cyber', 'holo', 'quantum'];
const DEFAULT_USERNAME = 'Vortex4047';
const PROFILE_SURPRISE_POOL = [
  'torvalds',
  'gaearon',
  'sindresorhus',
  'addyosmani',
  'yyx990803',
  'dhh',
  'tj',
  'kentcdodds',
  'JakeWharton',
  'kamranahmedse',
];

function pickRandom<T>(list: T[], current?: T) {
  const filtered = current === undefined ? list : list.filter((item) => item !== current);
  if (filtered.length === 0) return list[0];
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function readLocalNumberArray(key: string) {
  if (typeof window === 'undefined') return [] as number[];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'number') : [];
  } catch {
    return [];
  }
}

function readLocalStringArray(key: string) {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [usernameInput, setUsernameInput] = useState(DEFAULT_USERNAME);
  const [dashboard, setDashboard] = useState<GitHubDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [themeVariant, setThemeVariant] = useState<ThemeVariant>('cyber');
  const [partyMode, setPartyMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [heatmapWindow, setHeatmapWindow] = useState(180);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('commits');
  const [heatmapEventFilter, setHeatmapEventFilter] = useState('all');
  const [repoSort, setRepoSort] = useState<RepoSort>('stars');
  const [hideForks, setHideForks] = useState(false);
  const [showActiveReposOnly, setShowActiveReposOnly] = useState(false);

  const [favoriteRepoIds, setFavoriteRepoIds] = useState<number[]>(() => readLocalNumberArray('gh-dashboard-favorites'));
  const [recentUsers, setRecentUsers] = useState<string[]>(() => readLocalStringArray('gh-dashboard-recent-users'));

  const [compareInput, setCompareInput] = useState('torvalds');
  const [compareDashboard, setCompareDashboard] = useState<GitHubDashboardData | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const favoriteSet = useMemo(() => new Set(favoriteRepoIds), [favoriteRepoIds]);

  const loadProfile = useCallback(async (username: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchGitHubDashboardData(username);
      setDashboard(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load GitHub profile.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCompareProfile = useCallback(async (username: string) => {
    const sanitized = username.trim().replace(/^@/, '');
    if (!sanitized) return;

    setCompareLoading(true);
    setCompareError(null);

    try {
      const data = await fetchGitHubDashboardData(sanitized);
      setCompareDashboard(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load comparison profile.';
      setCompareError(message);
    } finally {
      setCompareLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile(DEFAULT_USERNAME);
    void loadCompareProfile(compareInput);
  }, [loadProfile, loadCompareProfile]);

  useEffect(() => {
    if (!dashboard?.user.login) return;
    setRecentUsers((prev) => [dashboard.user.login, ...prev.filter((item) => item !== dashboard.user.login)].slice(0, 8));
  }, [dashboard?.user.login]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('gh-dashboard-favorites', JSON.stringify(favoriteRepoIds));
  }, [favoriteRepoIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('gh-dashboard-recent-users', JSON.stringify(recentUsers));
  }, [recentUsers]);

  const filteredRepos = useMemo(() => {
    const repos = dashboard?.repos ?? [];
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();

    const filtered = repos.filter((repo) => {
      if (hideForks && repo.fork) return false;
      if (showActiveReposOnly && now - Date.parse(repo.updated_at) > 180 * 24 * 60 * 60 * 1000) return false;
      if (!query) return true;
      const haystack = `${repo.name} ${repo.description || ''} ${repo.language || ''}`.toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...filtered];

    if (repoSort === 'forks') {
      sorted.sort((a, b) => b.forks_count - a.forks_count);
    } else if (repoSort === 'updated') {
      sorted.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    } else if (repoSort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => b.stargazers_count - a.stargazers_count);
    }

    sorted.sort((a, b) => Number(favoriteSet.has(b.id)) - Number(favoriteSet.has(a.id)));

    return sorted;
  }, [dashboard?.repos, searchQuery, hideForks, showActiveReposOnly, repoSort, favoriteSet]);

  const languageCount = useMemo(() => {
    const repos = dashboard?.repos ?? [];
    return new Set(repos.map((repo) => repo.language).filter(Boolean)).size;
  }, [dashboard?.repos]);

  const handleLoadProfile = useCallback(() => {
    void loadProfile(usernameInput);
  }, [loadProfile, usernameInput]);

  const handleLoadCompare = useCallback(() => {
    void loadCompareProfile(compareInput);
  }, [loadCompareProfile, compareInput]);

  const handleLoadRecentUser = useCallback(
    (username: string) => {
      setUsernameInput(username);
      void loadProfile(username);
    },
    [loadProfile]
  );

  const handleSurpriseProfile = useCallback(() => {
    const current = dashboard?.user.login || usernameInput;
    const picked = pickRandom(PROFILE_SURPRISE_POOL, current);
    setUsernameInput(picked);
    void loadProfile(picked);
  }, [dashboard?.user.login, usernameInput, loadProfile]);

  const handleShuffleTheme = useCallback(() => {
    const nextTheme = pickRandom(THEMES, themeVariant);
    setThemeVariant(nextTheme);
  }, [themeVariant]);

  const handleToggleFavorite = useCallback((repoId: number) => {
    setFavoriteRepoIds((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [repoId, ...prev].slice(0, 30)
    );
  }, []);

  const handleExportSnapshot = useCallback(() => {
    if (!dashboard) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      user: dashboard.user,
      repos: filteredRepos,
      favoriteRepoIds,
      events: dashboard.events,
      ui: {
        theme: themeVariant,
        partyMode,
        focusMode,
      },
      heatmap: {
        windowDays: heatmapWindow,
        mode: heatmapMode,
        filter: heatmapEventFilter,
      },
      compareUser: compareDashboard?.user || null,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${dashboard.user.login}-dashboard-snapshot.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [
    dashboard,
    filteredRepos,
    favoriteRepoIds,
    themeVariant,
    partyMode,
    focusMode,
    heatmapWindow,
    heatmapMode,
    heatmapEventFilter,
    compareDashboard,
  ]);

  const handleCopySummary = useCallback(async () => {
    if (!dashboard) return;
    const summary = [
      `Developer: ${dashboard.user.name || dashboard.user.login} (@${dashboard.user.login})`,
      `Repos shown: ${filteredRepos.length}`,
      `Favorites pinned: ${favoriteRepoIds.length}`,
      `Total stars: ${filteredRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0)}`,
      `Events loaded: ${dashboard.events.length}`,
      `Heatmap: ${heatmapWindow}d, mode=${heatmapMode}, filter=${heatmapEventFilter}`,
      `Theme: ${themeVariant}, party=${partyMode}, focus=${focusMode}`,
      compareDashboard ? `Compared with: @${compareDashboard.user.login}` : 'Compared with: none',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
    } catch {
      // best-effort clipboard write
    }
  }, [
    dashboard,
    filteredRepos,
    favoriteRepoIds.length,
    heatmapWindow,
    heatmapMode,
    heatmapEventFilter,
    themeVariant,
    partyMode,
    focusMode,
    compareDashboard,
  ]);

  const commands = useMemo<CommandItem[]>(
    () => [
      { id: 'cmd-surprise', label: 'Load Surprise Profile', hint: 'Shift + R', run: handleSurpriseProfile, keywords: ['random', 'profile'] },
      { id: 'cmd-theme-shuffle', label: 'Shuffle Theme', run: handleShuffleTheme, keywords: ['theme', 'style'] },
      {
        id: 'cmd-toggle-party',
        label: partyMode ? 'Disable Party Mode' : 'Enable Party Mode',
        hint: 'Shift + P',
        run: () => setPartyMode((prev) => !prev),
      },
      {
        id: 'cmd-toggle-focus',
        label: focusMode ? 'Disable Focus Mode' : 'Enable Focus Mode',
        hint: 'Shift + F',
        run: () => setFocusMode((prev) => !prev),
      },
      { id: 'cmd-theme-cyber', label: 'Switch Theme: Cyber', run: () => setThemeVariant('cyber') },
      { id: 'cmd-theme-holo', label: 'Switch Theme: Hologram', run: () => setThemeVariant('holo') },
      { id: 'cmd-theme-quantum', label: 'Switch Theme: Quantum', run: () => setThemeVariant('quantum') },
      {
        id: 'cmd-reset-search',
        label: 'Clear Filters & Search',
        run: () => {
          setSearchQuery('');
          setHideForks(false);
          setShowActiveReposOnly(false);
          setHeatmapEventFilter('all');
          setRepoSort('stars');
        },
      },
      { id: 'cmd-copy-summary', label: 'Copy Dashboard Summary', run: () => void handleCopySummary() },
      { id: 'cmd-export', label: 'Export Snapshot JSON', run: handleExportSnapshot },
      ...PROFILE_SURPRISE_POOL.slice(0, 5).map((username) => ({
        id: `cmd-load-${username}`,
        label: `Load @${username}`,
        run: () => {
          setUsernameInput(username);
          void loadProfile(username);
        },
        keywords: ['load', 'profile', 'user'],
      })),
    ],
    [
      handleSurpriseProfile,
      handleShuffleTheme,
      partyMode,
      focusMode,
      handleCopySummary,
      handleExportSnapshot,
      loadProfile,
    ]
  );

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }

      if (isTypingTarget(event.target)) return;

      if (event.shiftKey && key === 'p') {
        event.preventDefault();
        setPartyMode((prev) => !prev);
      } else if (event.shiftKey && key === 'f') {
        event.preventDefault();
        setFocusMode((prev) => !prev);
      } else if (event.shiftKey && key === 'r') {
        event.preventDefault();
        handleSurpriseProfile();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSurpriseProfile]);

  return (
    <div className={`dashboard-shell theme-${themeVariant} ${partyMode ? 'mode-party' : ''} ${focusMode ? 'mode-focus' : ''}`}>
      <div className="dashboard-shell__glow dashboard-shell__glow--left"></div>
      <div className="dashboard-shell__glow dashboard-shell__glow--right"></div>
      <div className="dashboard-shell__mesh"></div>
      <div className="dashboard-shell__scan"></div>

      <div className="relative max-w-[1400px] mx-auto px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="hero-title">Developer Persona</h1>
          <div className="theme-switcher" role="radiogroup" aria-label="Theme Variant">
            {(THEMES.map((theme) => ({ id: theme, label: theme === 'holo' ? 'Hologram' : theme === 'quantum' ? 'Quantum' : 'Cyber' })) as Array<{
              id: ThemeVariant;
              label: string;
            }>).map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={themeVariant === item.id}
                className={`theme-switcher__btn ${themeVariant === item.id ? 'theme-switcher__btn--active' : ''}`}
                onClick={() => setThemeVariant(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <ScrollReveal>
          <Header
            user={dashboard?.user ?? null}
            languageCount={languageCount}
            usernameInput={usernameInput}
            searchQuery={searchQuery}
            loading={loading}
            error={error}
            onUsernameInputChange={setUsernameInput}
            onSearchChange={setSearchQuery}
            onLoadProfile={handleLoadProfile}
          />
        </ScrollReveal>

        <ScrollReveal delay={20} className="mt-6">
          <FunDock
            currentUsername={dashboard?.user.login || null}
            themeVariant={themeVariant}
            partyMode={partyMode}
            focusMode={focusMode}
            recentUsers={recentUsers}
            onTogglePartyMode={() => setPartyMode((prev) => !prev)}
            onToggleFocusMode={() => setFocusMode((prev) => !prev)}
            onShuffleTheme={handleShuffleTheme}
            onSurpriseProfile={handleSurpriseProfile}
            onOpenCommandPalette={() => setPaletteOpen(true)}
            onLoadRecentUser={handleLoadRecentUser}
          />
        </ScrollReveal>

        <ScrollReveal delay={30} className="mt-6">
          <DashboardControls
            events={dashboard?.events ?? []}
            repos={dashboard?.repos ?? []}
            heatmapWindow={heatmapWindow}
            heatmapMode={heatmapMode}
            heatmapEventFilter={heatmapEventFilter}
            repoSort={repoSort}
            hideForks={hideForks}
            showActiveReposOnly={showActiveReposOnly}
            onHeatmapWindowChange={setHeatmapWindow}
            onHeatmapModeChange={setHeatmapMode}
            onHeatmapEventFilterChange={setHeatmapEventFilter}
            onRepoSortChange={setRepoSort}
            onHideForksChange={setHideForks}
            onShowActiveReposOnlyChange={setShowActiveReposOnly}
            onExportSnapshot={handleExportSnapshot}
            onCopySummary={handleCopySummary}
          />
        </ScrollReveal>

        {!focusMode && (
          <ScrollReveal delay={42} className="mt-6">
            <ActivityLab events={dashboard?.events ?? []} repos={filteredRepos} loading={loading} />
          </ScrollReveal>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="space-y-6">
            <ScrollReveal delay={55}>
              <ImpactMetrics repos={dashboard?.repos ?? []} events={dashboard?.events ?? []} loading={loading} />
            </ScrollReveal>
            <ScrollReveal delay={90}>
              <TechStack repos={dashboard?.repos ?? []} loading={loading} />
            </ScrollReveal>
          </div>

          <div className="space-y-6">
            <ScrollReveal delay={70}>
              <ContributionHeatmap
                events={dashboard?.events ?? []}
                loading={loading}
                days={heatmapWindow}
                mode={heatmapMode}
                eventFilter={heatmapEventFilter}
              />
            </ScrollReveal>
            <ScrollReveal delay={120}>
              <TopRepositories
                repos={filteredRepos}
                loading={loading}
                query={searchQuery}
                favoriteRepoIds={favoriteRepoIds}
                onToggleFavorite={handleToggleFavorite}
              />
            </ScrollReveal>
          </div>
        </div>

        {!focusMode && (
          <ScrollReveal delay={150} className="mt-6">
            <ActivityStream title="Recent Activity Stream" events={dashboard?.events ?? []} loading={loading} />
          </ScrollReveal>
        )}

        {!focusMode && (
          <ScrollReveal delay={170} className="mt-6">
            <DeveloperCompare
              primary={dashboard}
              compare={compareDashboard}
              compareInput={compareInput}
              compareLoading={compareLoading}
              compareError={compareError}
              onCompareInputChange={setCompareInput}
              onLoadCompare={handleLoadCompare}
            />
          </ScrollReveal>
        )}
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <Analytics />
    </div>
  );
}
