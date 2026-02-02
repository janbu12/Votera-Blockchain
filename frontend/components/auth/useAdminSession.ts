import { useEffect, useState } from "react";

export function useAdminSession() {
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    fetch("/api/admin/me")
      .then((res) => setIsAdminAuthed(res.ok))
      .catch(() => setIsAdminAuthed(false))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  return { isAdminAuthed, loading, refresh };
}
