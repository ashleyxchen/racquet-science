/**
 * useSessionsList Hook
 *
 * Manages fetching, filtering, and grouping of sessions list from backend.
 * Features:
 * - Automatic data fetching on mount
 * - Search/filter by session name or ID
 * - Group sessions by month (newest first)
 * - Loading and error state management
 * - Manual refresh support
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { listSessions, type SessionResponse } from '../services/api/sessions';
import { format, parseISO } from 'date-fns';

interface GroupedSessions {
  month: string; // e.g., "February 2026"
  sessions: SessionResponse[];
}

interface UseSessionsListResult {
  sessions: SessionResponse[];
  groupedSessions: GroupedSessions[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  refresh: () => void;
}

/**
 * Hook for managing sessions list with search and grouping
 */
export function useSessionsList(): UseSessionsListResult {
  const [allSessions, setAllSessions] = useState<SessionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch sessions from backend
  useEffect(() => {
    let mounted = true;

    const fetchSessions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch all sessions (no pagination limit)
        const response = await listSessions({ limit: 1000 });

        if (mounted) {
          setAllSessions(response.sessions);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sessions';
          setError(errorMessage);
          console.error('Error fetching sessions:', err);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSessions();

    return () => {
      mounted = false;
    };
  }, [refreshTrigger]);

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) {
      return allSessions;
    }

    const query = searchQuery.toLowerCase().trim();

    return allSessions.filter((session) => {
      // Search by ID
      if (session.id.toString().includes(query)) {
        return true;
      }

      // Search by session name (in metadata)
      if (session.session_metadata && typeof session.session_metadata === 'object') {
        const metadata = session.session_metadata as Record<string, unknown>;
        const name = metadata.name;
        if (typeof name === 'string' && name.toLowerCase().includes(query)) {
          return true;
        }
      }

      // Search by status
      if (session.status.toLowerCase().includes(query)) {
        return true;
      }

      return false;
    });
  }, [allSessions, searchQuery]);

  // Group sessions by month and sort
  const groupedSessions = useMemo(() => {
    // Sort sessions by date (newest first)
    const sortedSessions = [...filteredSessions].sort((a, b) => {
      const dateA = a.started_at || a.created_at;
      const dateB = b.started_at || b.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    // Group by month
    const groups = new Map<string, SessionResponse[]>();

    sortedSessions.forEach((session) => {
      try {
        const dateStr = session.started_at || session.created_at;
        const date = parseISO(dateStr);
        const monthKey = format(date, 'MMMM yyyy'); // e.g., "February 2026"

        if (!groups.has(monthKey)) {
          groups.set(monthKey, []);
        }
        groups.get(monthKey)!.push(session);
      } catch (err) {
        console.error('Error parsing date for session:', session.id, err);
      }
    });

    // Convert to array format, maintaining chronological order (newest first)
    return Array.from(groups.entries()).map(([month, sessions]) => ({
      month,
      sessions,
    }));
  }, [filteredSessions]);

  // Manual refresh function
  const refresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return {
    sessions: filteredSessions,
    groupedSessions,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    refresh,
  };
}
