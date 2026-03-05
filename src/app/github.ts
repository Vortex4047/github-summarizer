export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  followers: number;
  public_repos: number;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  fork: boolean;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
  html_url: string;
}

interface RawGitHubEvent {
  id: string;
  type: string;
  created_at: string;
  repo?: {
    name?: string;
  };
  payload?: {
    commits?: { sha: string }[];
    action?: string;
    pull_request?: {
      merged?: boolean;
      number?: number;
    };
  };
}

export interface GitHubEvent {
  id: string;
  type: string;
  createdAt: string;
  repoName: string;
  commitCount: number;
  prMerged: boolean;
}

export interface GitHubDashboardData {
  user: GitHubUser;
  repos: GitHubRepo[];
  events: GitHubEvent[];
}

async function fetchGitHubJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const token = import.meta.env.VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { message?: string })?.message || 'GitHub request failed';
    throw new Error(`${message} (${response.status})`);
  }

  return payload as T;
}

async function fetchUserEvents(username: string, pages = 2): Promise<GitHubEvent[]> {
  const allEvents: RawGitHubEvent[] = [];

  for (let page = 1; page <= pages; page += 1) {
    const url = `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100&page=${page}`;
    const pageEvents = await fetchGitHubJson<RawGitHubEvent[]>(url);

    if (!Array.isArray(pageEvents) || pageEvents.length === 0) {
      break;
    }

    allEvents.push(...pageEvents);
  }

  const deduped = new Map<string, RawGitHubEvent>();
  allEvents.forEach((event) => {
    if (event?.id && !deduped.has(event.id)) {
      deduped.set(event.id, event);
    }
  });

  return Array.from(deduped.values())
    .map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.created_at,
      repoName: event.repo?.name || 'unknown/repository',
      commitCount:
        event.type === 'PushEvent'
          ? Math.max(1, event.payload?.commits?.length || 0)
          : 0,
      prMerged: Boolean(event.payload?.pull_request?.merged),
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function fetchGitHubDashboardData(username: string): Promise<GitHubDashboardData> {
  const sanitizedUsername = username.trim().replace(/^@/, '');
  if (!sanitizedUsername) {
    throw new Error('Please enter a GitHub username.');
  }

  const [user, repos, events] = await Promise.all([
    fetchGitHubJson<GitHubUser>(`https://api.github.com/users/${encodeURIComponent(sanitizedUsername)}`),
    fetchGitHubJson<GitHubRepo[]>(
      `https://api.github.com/users/${encodeURIComponent(sanitizedUsername)}/repos?per_page=100&sort=updated`
    ),
    fetchUserEvents(sanitizedUsername, 2),
  ]);

  return {
    user,
    repos: Array.isArray(repos) ? repos : [],
    events,
  };
}
