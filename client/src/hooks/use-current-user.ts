import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PlatformUser } from "@shared/schema";

const STORAGE_KEY = "hypertrade_current_user_id";

export function useCurrentUser() {
  const [userId, setUserId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  const { data: users = [] } = useQuery<PlatformUser[]>({
    queryKey: ["/api/platform-users"],
  });

  const currentUser = users.find((u) => u.id === userId) ?? null;

  const selectUser = useCallback((id: number | null) => {
    setUserId(id);
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(id));
    }
  }, []);

  return { currentUser, users, selectUser };
}
