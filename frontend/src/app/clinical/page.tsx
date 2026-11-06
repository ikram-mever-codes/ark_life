"use client";
// ═══════════════════════════════════════════════════════════════════════
// Clinical Records — Milestone 3
// Upload, list, preview and delete clinical documents (blood tests, lab and
// specialist reports, genetic reports…). Shows the processing state of each
// document (Processing / OCR Processing / Indexed / Failed) with retry, and
// a guided import from the Fascicolo Sanitario Elettronico (FSE).
// ═══════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileImage,
  FileText,
  HeartPulse,
  Landmark,
  Loader2,
  MessageSquare,
  RefreshCw,
  ScanText,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  addMemory,
  deleteMemoryFile,
  getFileObjectUrl,
  getFileText,
  getVault,
  isProcessing,
  MemoryVaultFile,
  retryMemoryFile,
  setFileCategory,
  STATUS_LABELS,
  VaultData,
} from "@/api/memory";
import { listAvatars, Avatar } from "@/api/avatars";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.docx,.txt,.md";
const FSE_PORTAL_URL = "https://www.fascicolosanitario.gov.it/";

const fmtSize = (b?: number) =>
  !b
    ? ""
    : b > 1024 * 1024
      ? `${(b / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(b / 1024))} KB`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// ─── Status badge ──────────────────────────────────────────────────────
function StatusBadge({ file }: { file: MemoryVaultFile }) {
  const s = file.status;
  const cls =
    s === "indexed"
      ? "text-primary bg-primary/10 border-primary/30"
      : s === "failed"
        ? "text-error bg-error/10 border-error/30"
        : "text-warning bg-warning/10 border-warning/30";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${cls}`}
    >
      {isProcessing(file) && <Loader2 size={12} className="animate-spin" />}
      {s === "indexed" && <CheckCircle2 size={12} />}
      {s === "failed" && <AlertTriangle size={12} />}
      {STATUS_LABELS[s]}
    </span>
  );
}

// ─── Document viewer modal ─────────────────────────────────────────────
function DocumentViewer({
  file,
  onClose,
}: {
  file: MemoryVaultFile;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"original" | "text">(
    file.fileType === "docx" ? "text" : "original",
  );
  const [blob, setBlob] = useState<{ url: string; type: string } | null>(null);
  const [plain, setPlain] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    getFileObjectUrl(file._id)
      .then(async (r) => {
        url = r.url;
        setBlob(r);
        if (["txt", "md", "json"].includes(file.fileType)) {
          setPlain(await (await fetch(r.url)).text());
        }
      })
      .catch((e) => setErr(e.message));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file._id, file.fileType]);

  useEffect(() => {
    if (tab !== "text" || text !== null) return;
    getFileText(file._id)
      .then((r) => setText(r.text || ""))
      .catch(() => setText(""));
  }, [tab, text, file._id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-overlay backdrop-blur-sm flex items-center justify-center p-2 sm:p-6"
      onClick={onClose}
    >
      <div
        className="ui-panel-elevated w-full max-w-5xl h-[92vh] rounded-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div className="min-w-0">
            <p className="font-semibold truncate">{file.fileName}</p>
            <p className="hud-label !text-[10px]">
              {fmtDate(file.uploadDate)}
              {file.pageCount ? ` · ${file.pageCount} pages` : ""}
              {file.ocrUsed ? " · OCR" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              {(["original", "text"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 ${tab === t ? "bg-primary text-background font-semibold" : "text-foreground-muted hover:text-foreground"}`}
                >
                  {t === "original" ? "Document" : "Extracted text"}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-primary/10"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-background">
          {err ? (
            <p className="p-6 text-error text-sm">{err}</p>
          ) : tab === "text" ? (
            text === null ? (
              <Centered>
                <Loader2 className="animate-spin text-primary" />
              </Centered>
            ) : text ? (
              <pre className="h-full overflow-auto p-4 sm:p-6 text-sm whitespace-pre-wrap font-mono text-foreground-muted">
                {text}
              </pre>
            ) : (
              <Centered>
                <p className="text-sm text-foreground-muted">
                  No extracted text yet (document not indexed).
                </p>
              </Centered>
            )
          ) : !blob ? (
            <Centered>
              <Loader2 className="animate-spin text-primary" />
            </Centered>
          ) : file.fileType === "pdf" ? (
            <iframe
              src={blob.url}
              title={file.fileName}
              className="w-full h-full border-0 bg-white"
            />
          ) : ["jpg", "png"].includes(file.fileType) ? (
            <div className="h-full overflow-auto flex items-start justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={blob.url} alt={file.fileName} className="max-w-full" />
            </div>
          ) : plain !== null ? (
            <pre className="h-full overflow-auto p-4 sm:p-6 text-sm whitespace-pre-wrap font-mono">
              {plain}
            </pre>
          ) : (
            <Centered>
              <div className="text-center space-y-3">
                <p className="text-sm text-foreground-muted">
                  This file type cannot be previewed in the browser.
                </p>
                <a
                  href={blob.url}
                  download={file.fileName}
                  className="inline-block text-sm text-primary underline"
                >
                  Download file
                </a>
              </div>
            </Centered>
          )}
        </div>
      </div>
    </div>
  );
}

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="h-full flex items-center justify-center p-6">{children}</div>
);

// ─── FSE guided import ─────────────────────────────────────────────────
function FseImportModal({
  onClose,
  onUpload,
}: {
  onClose: () => void;
  onUpload: (files: FileList) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const steps = [
    {
      title: "Open your Fascicolo Sanitario",
      body: "Open the official FSE portal and choose your region. You log in there directly with SPID or CIE — ArkLife never sees or stores your credentials.",
    },
    {
      title: "Download your reports",
      body: "In the FSE, open the documents you want (referti, analisi, lettere di dimissione…) and download them as PDF.",
    },
    {
      title: "Import them into ArkLife",
      body: "Select the downloaded PDFs below. They are added to your Clinical Records, read (with OCR if needed) and made available to your AI.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] bg-overlay backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="ui-panel-elevated w-full max-w-lg rounded-lg p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-deep flex items-center justify-center">
              <Landmark size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="hud-title text-lg">Import from FSE</h2>
              <p className="text-xs text-foreground-muted">
                Fascicolo Sanitario Elettronico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-primary/10"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <ol className="space-y-4 mb-6">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="h-6 w-6 shrink-0 rounded-full border border-primary text-primary text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={FSE_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-sm font-semibold px-4 py-2.5 rounded-md border border-border hover:border-primary/50 transition-colors"
          >
            1 · Open FSE portal ↗
          </a>
          <button
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-md bg-primary text-background hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            3 · Select downloaded PDFs
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            className="hidden"
            onChange={async (e) => {
              if (!e.target.files?.length) return;
              setBusy(true);
              try {
                await onUpload(e.target.files);
                onClose();
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────
export default function ClinicalRecordsPage() {
  const [vault, setVault] = useState<VaultData | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"clinical" | "other">("clinical");
  const [viewing, setViewing] = useState<MemoryVaultFile | null>(null);
  const [fseOpen, setFseOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setVault(await getVault());
    } catch {
      /* toast handled in api */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    listAvatars()
      .then(setAvatars)
      .catch(() => {});
  }, [load]);

  const files = useMemo(() => vault?.files ?? [], [vault]);
  const clinical = files.filter((f) => f.category === "clinical");
  // Older uploads that are not tied to an avatar (pre-Milestone 3 "Memory" uploads).
  const other = files.filter((f) => f.category !== "clinical" && !f.avatarId);
  const anyProcessing = files.some(isProcessing);

  // Poll while something is being processed.
  useEffect(() => {
    if (!anyProcessing) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [anyProcessing, load]);

  const uploadFiles = async (list: FileList | File[], source: "upload" | "fse") => {
    const arr = Array.from(list);
    setUploading((n) => n + arr.length);
    for (const file of arr) {
      try {
        await addMemory({ file, category: "clinical", source });
        toast.success(`${file.name}: uploaded, processing…`);
      } catch {
        /* toast shown by api interceptor */
      } finally {
        setUploading((n) => n - 1);
      }
    }
    setTab("clinical");
    await load();
  };

  const handleDelete = async (f: MemoryVaultFile) => {
    if (!confirm(`Delete "${f.fileName}"? This cannot be undone.`)) return;
    await deleteMemoryFile(f._id);
    await load();
  };

  const handleRetry = async (f: MemoryVaultFile) => {
    try {
      await retryMemoryFile(f._id);
      toast.success("Processing restarted");
      await load();
    } catch {
      /* handled */
    }
  };

  const handleMoveToClinical = async (f: MemoryVaultFile) => {
    try {
      await setFileCategory(f._id, "clinical");
      toast.success("Moved to Clinical Records");
      await load();
    } catch {
      /* handled */
    }
  };

  const shown = (tab === "clinical" ? clinical : other)
    .filter((f) => f.fileName.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => +new Date(b.uploadDate) - +new Date(a.uploadDate));

  const stats = [
    { label: "Documents", value: clinical.length },
    {
      label: "Indexed",
      value: clinical.filter((f) => f.status === "indexed").length,
    },
    { label: "Processing", value: clinical.filter(isProcessing).length },
    {
      label: "Failed",
      value: clinical.filter((f) => f.status === "failed").length,
    },
  ];

  const chatHref = avatars[0] ? `/avatars/${avatars[0]._id}/chat` : "/avatars";

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  return (
    <div
      className="container mx-auto px-4 py-6 sm:py-10 max-w-6xl"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files, "upload");
      }}
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse size={18} className="text-primary" />
            <span className="hud-label">Clinical area</span>
          </div>
          <h1 className="hud-title text-3xl sm:text-4xl">Clinical Records</h1>
          <p className="text-sm text-foreground-muted mt-2 max-w-xl">
            Blood tests, lab and specialist reports, genetic reports. Scanned
            documents are read automatically with OCR and become available to
            your ArkLife AI.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setFseOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-md border border-border hover:border-primary/50 text-sm font-semibold transition-colors"
          >
            <Landmark size={16} className="text-primary" /> Import from FSE
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-primary text-background hover:bg-primary-hover text-sm font-semibold transition-colors"
          >
            {uploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            {uploading ? `Uploading (${uploading})…` : "Upload document"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) uploadFiles(e.target.files, "upload");
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="ui-panel rounded-lg px-4 py-3">
            <p className="hud-label">{s.label}</p>
            <p className="hud-metric text-2xl mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Ask AI hint */}
      {clinical.some((f) => f.status === "indexed") && (
        <Link
          href={chatHref}
          className="flex items-center gap-3 ui-panel rounded-lg px-4 py-3 mb-6 hover:border-primary/50 transition-colors"
        >
          <MessageSquare size={18} className="text-primary shrink-0" />
          <p className="text-sm text-foreground-muted">
            Ask your AI about these documents — e.g.{" "}
            <span className="text-foreground">
              “Confronta i miei ultimi tre esami del sangue”
            </span>
          </p>
        </Link>
      )}

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex rounded-md border border-border overflow-hidden text-sm w-fit">
          <button
            onClick={() => setTab("clinical")}
            className={`px-4 py-2 ${tab === "clinical" ? "bg-deep text-primary font-semibold" : "text-foreground-muted"}`}
          >
            Clinical ({clinical.length})
          </button>
          {other.length > 0 && (
            <button
              onClick={() => setTab("other")}
              className={`px-4 py-2 ${tab === "other" ? "bg-deep text-primary font-semibold" : "text-foreground-muted"}`}
            >
              Other uploads ({other.length})
            </button>
          )}
        </div>
        <div className="relative sm:w-72">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents"
            className="w-full bg-surface border border-border rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {tab === "other" && (
        <p className="text-xs text-foreground-muted mb-3">
          Documents uploaded before the Clinical area existed. Move clinical
          reports here with “Move to Clinical”. Personal memories for an avatar
          are managed on the avatar&apos;s page.
        </p>
      )}

      {/* Document list */}
      {shown.length === 0 ? (
        <div
          className={`ui-panel rounded-lg border-dashed py-16 px-6 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : ""}`}
        >
          <FileText size={36} className="mx-auto text-foreground-subtle mb-3" />
          <p className="font-semibold">
            {query ? "No documents match your search" : "No documents yet"}
          </p>
          <p className="text-sm text-foreground-muted mt-1">
            Drag & drop PDFs or photos of your reports here, or use “Upload
            document”.
          </p>
        </div>
      ) : (
        <ul
          className={`ui-panel rounded-lg divide-y divide-divider transition-colors ${dragOver ? "border-primary" : ""}`}
        >
          {shown.map((f) => (
            <li
              key={f._id}
              className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4"
            >
              <button
                onClick={() => setViewing(f)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left group"
              >
                <div className="h-10 w-10 shrink-0 rounded-md bg-deep/60 flex items-center justify-center">
                  {["jpg", "png"].includes(f.fileType) ? (
                    <FileImage size={18} className="text-primary" />
                  ) : (
                    <FileText size={18} className="text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate group-hover:text-primary transition-colors">
                    {f.fileName}
                  </p>
                  <p className="text-xs text-foreground-subtle flex flex-wrap gap-x-2">
                    <span>{fmtDate(f.uploadDate)}</span>
                    {f.sizeBytes ? <span>· {fmtSize(f.sizeBytes)}</span> : null}
                    {f.pageCount ? <span>· {f.pageCount} p.</span> : null}
                    {f.source === "fse" && (
                      <span className="text-primary">· FSE</span>
                    )}
                    {f.ocrUsed && (
                      <span className="inline-flex items-center gap-1">
                        · <ScanText size={11} /> OCR
                      </span>
                    )}
                  </p>
                </div>
              </button>

              <div className="flex flex-col md:items-end gap-1 md:w-56">
                <StatusBadge file={f} />
                {f.status === "failed" && f.indexError && (
                  <p className="text-xs text-error/90 md:text-right line-clamp-2">
                    {f.indexError}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 md:justify-end">
                {f.status === "failed" && (
                  <IconBtn label="Retry" onClick={() => handleRetry(f)}>
                    <RefreshCw size={16} />
                  </IconBtn>
                )}
                {tab === "other" && (
                  <button
                    onClick={() => handleMoveToClinical(f)}
                    className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-primary/50 hover:text-primary"
                  >
                    Move to Clinical
                  </button>
                )}
                <IconBtn label="View" onClick={() => setViewing(f)}>
                  <Eye size={16} />
                </IconBtn>
                <IconBtn label="Delete" danger onClick={() => handleDelete(f)}>
                  <Trash2 size={16} />
                </IconBtn>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-foreground-subtle mt-6 leading-relaxed">
        ArkLife helps you read and organise your documents; it does not replace
        your doctor. Documents are private to your account.
      </p>

      {viewing && (
        <DocumentViewer file={viewing} onClose={() => setViewing(null)} />
      )}
      {fseOpen && (
        <FseImportModal
          onClose={() => setFseOpen(false)}
          onUpload={(fl) => uploadFiles(fl, "fse")}
        />
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-2 rounded-md transition-colors ${danger ? "text-foreground-subtle hover:text-error hover:bg-error/10" : "text-foreground-muted hover:text-primary hover:bg-primary/10"}`}
    >
      {children}
    </button>
  );
}
