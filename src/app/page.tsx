'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';

const cardClasses =
  'w-full rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-black/30 backdrop-blur sm:p-8';

const LANGUAGES = [
  { label: 'Auto Detect', value: 'auto' },
  { label: 'English', value: 'en' },
  { label: 'Hindi', value: 'hi' },
  { label: 'Marathi', value: 'mr' },
  { label: 'Spanish', value: 'es' },
];

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const [extractedText, setExtractedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [processedText, setProcessedText] = useState('');
  const [isProcessingText, setIsProcessingText] = useState(false);
  const [processingMode, setProcessingMode] = useState<'summarize' | 'rewrite' | undefined>(undefined);
  const [language, setLanguage] = useState('auto');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fileLabel = useMemo(() => {
    if (!selectedFile) return 'No file selected';
    return `${selectedFile.name} (${Math.ceil(selectedFile.size / 1024)} KB)`;
  }, [selectedFile]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? undefined);
    setError('');
  }, []);

  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
    }
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(undefined);
      return undefined;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  const handleExtract = useCallback(async () => {
    if (!selectedFile) {
      setError('Please select an image before extracting.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('language', language);

      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || 'Failed to extract text.');
      }

      const data = (await response.json()) as { text?: string };
      setExtractedText(data.text ?? '');
      setProcessedText('');
    } catch (err) {
      console.error('Extraction failed', err);
      setError(err instanceof Error ? err.message : 'Unexpected error during extraction.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, language]);

  const handleProcessText = useCallback(
    async (mode: 'summarize' | 'rewrite') => {
      if (!extractedText.trim()) {
        setError('Extract text first or enter content to process.');
        return;
      }

      try {
        setIsProcessingText(true);
        setProcessingMode(mode);
        setError('');

        const response = await fetch('/api/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: extractedText, mode }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || 'Failed to process text.');
        }

        const data = (await response.json()) as { text?: string };
        setProcessedText(data.text ?? '');
      } catch (err) {
        console.error('Text processing failed', err);
        setError(err instanceof Error ? err.message : 'Unexpected error while processing text.');
      } finally {
        setIsProcessingText(false);
        setProcessingMode(undefined);
      }
    },
    [extractedText]
  );

  const handleDownloadTxt = useCallback(() => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'extracted-text.txt');
  }, [extractedText]);

  const handleDownloadPdf = useCallback(() => {
    if (!extractedText) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margins = { left: 64, right: 64, top: 96, bottom: 96 };
    const contentWidth = pageWidth - margins.left - margins.right;

    const formattedDate = new Date().toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Extracted Handwritten Text', pageWidth / 2, margins.top - 28, { align: 'center' });

    // Date subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(90, 99, 120);
    doc.text(`Generated on ${formattedDate}`, pageWidth / 2, margins.top - 4, { align: 'center' });

    // Reset text style for body
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(25, 29, 39);

    const paragraphSpacing = 20;
    const lineHeightFactor = 1.6;
    const paragraphs = extractedText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

    let cursorY = margins.top;
    paragraphs.forEach((paragraph, index) => {
      const paragraphLines = doc.splitTextToSize(paragraph, contentWidth);
      const requiredHeight = paragraphLines.length * 12 * lineHeightFactor;

      if (cursorY + requiredHeight > pageHeight - margins.bottom) {
        doc.addPage();
        doc.setFont('times', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(25, 29, 39);
        cursorY = margins.top;
      }

      doc.text(paragraphLines, margins.left, cursorY, {
        maxWidth: contentWidth,
        lineHeightFactor,
        align: 'left',
      });

      cursorY += requiredHeight + (index < paragraphs.length - 1 ? paragraphSpacing : 0);
    });

    // Watermark / footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(140, 148, 170);
    doc.text('Generated by AI Handwritten Reader', pageWidth / 2, pageHeight - 40, { align: 'center' });
    doc.save('extracted-text.pdf');
  }, [extractedText]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="relative mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div className="absolute inset-0 -z-10 mx-auto h-48 max-w-4xl rounded-full bg-cyan-500/20 blur-3xl" aria-hidden />
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Handwriting Intelligence</p>
          <h1 className="text-3xl font-semibold text-white sm:text-5xl">
            Transform handwritten notes into digital text
          </h1>
          <p className="text-sm text-slate-300 sm:text-lg">
            Upload a scan or photo, let Gemini clean and read it, then export the results instantly.
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
        <section className={cardClasses}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="handwriting-upload"
                className="text-sm font-semibold uppercase tracking-wide text-slate-300"
              >
                Upload handwritten document
              </label>
              <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-white/20 bg-slate-900/60 p-6 text-slate-300">
                <input
                  id="handwriting-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/40 transition hover:bg-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:w-fit"
                >
                  Choose image
                </button>
                <p className="text-sm text-slate-400">{fileLabel}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <label htmlFor="language" className="text-xs uppercase tracking-wide text-slate-500">
                    Language
                  </label>
                  <select
                    id="language"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                  >
                    {LANGUAGES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <button
                type="button"
                onClick={handleExtract}
                disabled={isLoading || !selectedFile}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-white/20 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-500/60 disabled:text-slate-300 disabled:shadow-none sm:w-auto"
              >
                {isLoading ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-b-transparent" />
                    Processing...
                  </>
                ) : (
                  'Extract text'
                )}
              </button>

              <div className="flex flex-col gap-2 text-sm text-slate-400 sm:ml-auto sm:flex-row sm:items-center sm:gap-3">
                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  disabled={!extractedText}
                  className="rounded-full border border-white/20 px-4 py-2 text-slate-200 transition hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:border-slate-700/60 disabled:text-slate-500"
                >
                  Export .txt
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={!extractedText}
                  className="rounded-full border border-white/20 px-4 py-2 text-slate-200 transition hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:border-slate-700/60 disabled:text-slate-500"
                >
                  Export .pdf
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            )}

            {previewUrl && (
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</h3>
                <div className="max-h-96 overflow-hidden rounded-xl border border-white/10 bg-slate-900/60">
                  <img
                    src={previewUrl}
                    alt="Preview of uploaded handwriting"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            )}

            {isLoading && (
              <p className="flex items-center gap-2 text-sm text-slate-300">
                <span className="h-2 w-2 animate-ping rounded-full bg-cyan-400" />
                Processing handwriting with Gemini...
              </p>
            )}
          </div>
        </section>

        <section className={cardClasses}>
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Extracted text</h2>
            {isLoading && <span className="text-xs text-slate-400">Processing...</span>}
          </header>
          <textarea
            value={extractedText}
            onChange={(event) => setExtractedText(event.target.value)}
            placeholder="The extracted text will appear here after processing."
            rows={12}
            className="mt-4 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 shadow-inner shadow-black/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-3">
            <button
              type="button"
              onClick={() => handleProcessText('summarize')}
              disabled={isProcessingText || !extractedText}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500 sm:w-auto"
            >
              {isProcessingText && processingMode === 'summarize' ? 'Summarizing...' : 'Summarize Text'}
            </button>
            <button
              type="button"
              onClick={() => handleProcessText('rewrite')}
              disabled={isProcessingText || !extractedText}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500 sm:w-auto"
            >
              {isProcessingText && processingMode === 'rewrite' ? 'Rewriting...' : 'Rewrite Text'}
            </button>
        </div>
        </section>

        {processedText && (
          <section className={cardClasses}>
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-white">Processed output</h2>
              {processingMode && <span className="text-xs text-slate-400 capitalize">{processingMode}...</span>}
            </header>
            <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-100">
              {processedText}
            </p>
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-12 text-center text-xs text-slate-500 sm:px-6">
        Gemini 1.5 Flash powers handwritten text recognition. Ensure you configure <code>GEMINI_API_KEY</code> in
        your environment.
      </footer>
    </div>
  );
}
