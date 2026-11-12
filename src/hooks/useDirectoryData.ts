import { useCallback, useEffect, useState } from "react";
import { parseDirectoryData } from "../../shared/directory";
import type { DirectoryData } from "../../shared/directory";

type DirectoryState =
  | { status: "loading"; data: null }
  | { status: "ready"; data: DirectoryData }
  | { status: "error"; data: null };

export default function useDirectoryData() {
  const [state, setState] = useState<DirectoryState>({
    status: "loading",
    data: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    void fetch("/api/directory", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Directory unavailable");
        return response.json() as Promise<unknown>;
      })
      .then(parseDirectoryData)
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch(() => {
        if (active) setState({ status: "error", data: null });
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading", data: null });
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, retry };
}
