"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

type AskResult = {
  answer: string;
  provider: "groq" | "extractive";
  debug?: string;
  citations: Array<{ id: number; title: string; url: string; snippet: string }>;
};

type IntegrationStatus = {
  id: string;
  name: string;
  connected: boolean;
  itemCount: number;
};

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = useState("Ready to analyze your notes");
  const [question, setQuestion] = useState("");
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadIntegrations() {
      if (!isLoaded || !isSignedIn) return;
      const res = await fetch("/api/integrations/status");
      const data = await res.json();
      if (data.ok) setIntegrations(data.integrations ?? []);
    }
    void loadIntegrations();
  }, [isLoaded, isSignedIn]);

  const notionConnected = integrations.find((i) => i.id === "notion")?.connected ?? false;
  const manualCount = integrations.find((i) => i.id === "manual")?.itemCount ?? 0;
  const hasAnySource = notionConnected || manualCount > 0;

  async function refreshIntegrations() {
    if (!isSignedIn) return;
    const res = await fetch("/api/integrations/status");
    const data = await res.json();
    if (data.ok) setIntegrations(data.integrations ?? []);
  }

  async function connectNotion() {
    window.location.href = "/api/notion/connect?returnTo=/";
  }

  async function ingest() {
    setLoading(true);
    setStatus("Indexing connected sources...");
    setResult(null);

    const res = await fetch("/api/ingest", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      setStatus(`Index complete: ${data.pages} documents, ${data.chunks} chunks indexed`);
    } else {
      setStatus(`Ingest failed: ${data.error}`);
    }
    setLoading(false);
  }

  async function addManualNote() {
    if (!noteContent.trim()) return;
    setLoading(true);
    setStatus("Saving manual note...");
    const res = await fetch("/api/integrations/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: noteTitle,
        content: noteContent,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setNoteTitle("");
      setNoteContent("");
      setStatus(`Note saved and indexed (${data.chunks} chunks)`);
      await refreshIntegrations();
    } else {
      setStatus(`Save note failed: ${data.error}`);
    }
    setLoading(false);
  }

  async function uploadSelectedFiles() {
    if (!uploadFiles?.length) return;
    setLoading(true);
    setStatus("Uploading files...");

    const form = new FormData();
    Array.from(uploadFiles).forEach((file) => form.append("files", file));

    const res = await fetch("/api/integrations/upload", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (data.ok) {
      const rejected = Array.isArray(data.rejected) && data.rejected.length ? `, skipped ${data.rejected.length}` : "";
      setStatus(`Uploaded ${data.uploaded} files (${data.chunks} chunks${rejected})`);
      setUploadFiles(null);
      await refreshIntegrations();
    } else {
      setStatus(`Upload failed: ${data.error}`);
    }
    setLoading(false);
  }

  async function addYouTubeTranscript() {
    if (!youtubeUrl.trim()) return;
    setLoading(true);
    setStatus("Fetching YouTube transcript...");
    const res = await fetch("/api/integrations/youtube", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: youtubeUrl }),
    });
    const data = await res.json();
    if (data.ok) {
      setYoutubeUrl("");
      setStatus(`YouTube transcript imported (${data.chunks} chunks)`);
      await refreshIntegrations();
    } else {
      setStatus(`YouTube import failed: ${data.error}`);
    }
    setLoading(false);
  }

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setStatus("Analyzing your notes...");

    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const data = await res.json();
    if (data.ok) {
      setResult({
        answer: data.answer,
        provider: data.provider,
        debug: data.debug,
        citations: data.citations,
      });
      setStatus(`Answer ready (${data.provider})`);
    } else {
      setStatus(`Ask failed: ${data.error}`);
    }

    setLoading(false);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10">
      <section className="rounded-2xl border border-white/50 bg-white/85 p-7 shadow-lg shadow-slate-200/70 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Research and Study Assistant
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">PaperTrail AI</h1>
            <p className="mt-2 text-sm text-slate-600">
              Ask research questions over the notes you already keep in Notion, with citations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isSignedIn ? (
              <a
                href="/sign-in"
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                Sign in
              </a>
            ) : (
              <>
              <button
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={connectNotion}
                disabled={loading}
              >
                {notionConnected ? "Reconnect Notion" : "Connect Notion"}
              </button>
              <button
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={ingest}
                disabled={loading || !hasAnySource}
              >
                {loading ? "Working..." : "Index Sources"}
              </button>
              <UserButton />
              </>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Add manual study/research note</label>
          <div className="grid gap-2">
            <input
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-indigo-200 placeholder:text-slate-400 focus:ring-2"
              placeholder="Optional title (e.g., Biology Chapter 4)"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <textarea
              className="min-h-28 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-indigo-200 placeholder:text-slate-400 focus:ring-2"
              placeholder="Paste your notes, highlights, formulas, summaries..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
            />
            <button
              className="justify-self-start rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={addManualNote}
              disabled={loading || !isSignedIn || !noteContent.trim()}
            >
              Save Note
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Upload study files</label>
          <p className="mb-2 text-xs text-slate-500">Supports .txt, .md, .csv, .json</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
              onChange={(e) => setUploadFiles(e.target.files)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            />
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={uploadSelectedFiles}
              disabled={loading || !isSignedIn || !uploadFiles?.length}
            >
              Upload Files
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Import YouTube transcript</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-indigo-200 placeholder:text-slate-400 focus:ring-2"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={addYouTubeTranscript}
              disabled={loading || !isSignedIn || !youtubeUrl.trim()}
            >
              Import Video
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Ask a research question</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-indigo-200 placeholder:text-slate-400 focus:ring-2"
              placeholder="What findings did I note about retention experiments?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={ask}
              disabled={loading || !isSignedIn}
            >
              Ask
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
          <p className="text-sm text-slate-700">
            Status: <span className="font-medium text-slate-900">{status}</span>
          </p>
          <p className="text-xs text-slate-600">
            Sources:{" "}
            <span className="font-semibold text-slate-800">
              Notion {notionConnected ? "connected" : "optional"} • Manual notes {manualCount}
            </span>
          </p>
        </div>
      </section>

      {result ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">Answer</h2>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              Provider: {result.provider}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-slate-800">{result.answer}</p>
          {result.debug ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Debug: {result.debug}
            </p>
          ) : null}

          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Citations</h3>
          <ul className="mt-3 space-y-3">
            {result.citations.map((c) => (
              <li key={c.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">
                  [{c.id}] {c.title}
                </p>
                <p className="mt-1 text-sm text-slate-700">{c.snippet}...</p>
                <a
                  className="mt-2 inline-block text-sm font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-500"
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open source
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
