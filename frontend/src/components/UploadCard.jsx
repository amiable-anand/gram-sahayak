import { useMemo, useRef, useState } from "react";

const MAX_MB = 25;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

async function createUploadUrl(apiBaseUrl, filename, contentType) {
  const res = await fetch(`${apiBaseUrl}/api/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, content_type: contentType }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create upload URL (${res.status}): ${text}`);
  }
  return await res.json();
}

function putWithProgress(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
    xhr.setRequestHeader("Content-Type", file.type || "application/pdf");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.send(file);
  });
}

export default function UploadCard({ apiBaseUrl, onUploaded }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | uploaded | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const fileMeta = useMemo(() => {
    if (!file) return null;
    return { name: file.name, size: formatBytes(file.size) };
  }, [file]);

  const pick = () => inputRef.current?.click();

  const onFileChange = (event) => {
    const picked = event.target.files?.[0] ?? null;
    setError("");
    setProgress(0);
    setStatus("idle");
    if (!picked) {
      setFile(null);
      return;
    }
    if (picked.type !== "application/pdf" && !picked.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      setFile(null);
      return;
    }
    if (picked.size > MAX_MB * 1024 * 1024) {
      setError(`Please upload a PDF under ${MAX_MB} MB.`);
      setFile(null);
      return;
    }
    setFile(picked);
  };

  const upload = async () => {
    if (!file || status === "uploading") return;
    setError("");
    setStatus("uploading");
    setProgress(1);

    try {
      const { upload_url: uploadUrl, blob_name: blobName } = await createUploadUrl(apiBaseUrl, file.name, file.type);
      await putWithProgress(uploadUrl, file, (pct) => setProgress(Math.max(1, pct)));
      setProgress(100);
      setStatus("uploaded");
      onUploaded?.({ blobName, filename: file.name });
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-slate-900">Upload scheme PDF</h2>
        <p className="text-xs text-slate-500">
          Upload a PDF and it will be indexed automatically. After indexing, ask questions in chat.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{fileMeta ? fileMeta.name : "No file selected"}</p>
              <p className="mt-1 text-xs text-slate-500">{fileMeta ? fileMeta.size : `PDF only, up to ${MAX_MB} MB`}</p>
            </div>
            <button
              type="button"
              onClick={pick}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Choose file
            </button>
          </div>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={onFileChange} className="hidden" />
        </div>

        <button
          type="button"
          onClick={upload}
          disabled={!file || status === "uploading"}
          className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {status === "uploading" ? `Uploading ${progress}%` : status === "uploaded" ? "Uploaded" : "Upload"}
        </button>
      </div>

      {(status === "uploading" || status === "uploaded") && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {status === "uploaded"
              ? "Uploaded. Indexing will start automatically (usually 1–3 minutes)."
              : "Uploading to Azure Blob Storage…"}
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <p className="font-medium">If upload fails with CORS error</p>
        <p className="mt-1 text-amber-900/80">
          Enable Blob CORS for your Storage account to allow <span className="font-mono">http://localhost:5173</span>{" "}
          and your production domain (methods: PUT, OPTIONS; headers: *; max age: 3600).
        </p>
      </div>
    </section>
  );
}

