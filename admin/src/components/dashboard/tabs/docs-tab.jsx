// In-app documentation tab — renders DOCS_SECTIONS from docs-data.js.
// No fetch, no DB — all content is hardcoded structured data.
import { useState, useCallback } from "react";
import { DOCS_SECTIONS } from "../data/docs-data";
import Icon from "../icon";
import { Card, SectionHeader } from "../ui-primitives";
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
      style={{
        backgroundColor: copied
          ? "rgba(74,222,128,0.15)"
          : "rgba(255,255,255,0.08)",
        color: copied ? "#4ade80" : "#9ca3af",
      }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ content, language }) {
  const langColors = {
    bash: "#86efac",
    go: "#67e8f9",
    json: "#fcd34d",
    sql: "#c4b5fd",
    jsx: "#fb923c",
    javascript: "#fbbf24",
    typescript: "#38bdf8",
    ini: "#a3e635",
    text: "#e2e8f0",
  };
  const color = langColors[language] || "#e2e8f0";
  return (
    <div
      className="rounded-xl overflow-hidden border mt-3"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ backgroundColor: "#1a1a2e" }}
      >
        <span className="text-xs font-mono font-medium" style={{ color }}>
          {language}
        </span>
        <CopyButton text={content} />
      </div>
      <pre
        className="overflow-x-auto px-4 py-4 text-xs leading-relaxed font-mono m-0"
        style={{
          backgroundColor: "#0f0f1a",
          color: "#e2e8f0",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {content}
      </pre>
    </div>
  );
}

function DataTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ backgroundColor: "var(--color-surface-2)" }}>
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left px-3 py-2 font-semibold border-b"
                style={{
                  color: "var(--color-text-secondary)",
                  borderColor: "var(--color-border)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="hover:bg-black/5 transition-colors border-b last:border-0"
              style={{ borderColor: "var(--color-border)" }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-2 align-top font-mono"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TextBlock({ content }) {
  const lines = content.split("\n");
  return (
    <div className="mt-3 space-y-2">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        // Bold emphasis
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p
            key={i}
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {parts.map((part, pi) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong
                  key={pi}
                  style={{
                    color: "var(--color-text-primary)",
                    fontWeight: 600,
                  }}
                >
                  {part.slice(2, -2)}
                </strong>
              ) : (
                <span key={pi}>{part}</span>
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}

function Subsection({ sub }) {
  const [open, setOpen] = useState(true);
  return (
    <div
      className="mb-4 border rounded-xl overflow-hidden"
      style={{ borderColor: "var(--color-border)" }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left transition-colors hover:bg-black/5"
        style={{
          backgroundColor: "var(--color-surface-2)",
          color: "var(--color-text-primary)",
        }}
      >
        <span>{sub.title}</span>
        {open ? (
          <ChevronDown size={14} style={{ color: "var(--color-text-muted)" }} />
        ) : (
          <ChevronRight
            size={14}
            style={{ color: "var(--color-text-muted)" }}
          />
        )}
      </button>
      {open && (
        <div
          className="px-4 pb-4"
          style={{ backgroundColor: "var(--color-surface)" }}
        >
          {sub.type === "text" && <TextBlock content={sub.content} />}
          {sub.type === "code" && (
            <CodeBlock content={sub.content} language={sub.language} />
          )}
          {sub.type === "table" && (
            <DataTable headers={sub.headers} rows={sub.rows} />
          )}
        </div>
      )}
    </div>
  );
}

export default function DocsTab() {
  const [activeSection, setActiveSection] = useState(DOCS_SECTIONS[0].id);
  const section =
    DOCS_SECTIONS.find((s) => s.id === activeSection) || DOCS_SECTIONS[0];

  return (
    <div className="flex gap-6">
      {/* Left nav */}
      <div className="w-52 shrink-0">
        <div className="sticky top-24">
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-3"
            style={{ color: "var(--color-text-muted)" }}
          >
            Sections
          </p>
          <nav className="space-y-0.5">
            {DOCS_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor:
                    activeSection === s.id
                      ? "var(--color-accent-bg)"
                      : "transparent",
                  color:
                    activeSection === s.id
                      ? "var(--color-accent)"
                      : "var(--color-text-secondary)",
                  fontWeight: activeSection === s.id ? 500 : 400,
                }}
              >
                <Icon name={s.icon} size={13} />
                {s.title}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <SectionHeader
          title={section.title}
          subtitle={`${section.subsections.length} section${section.subsections.length !== 1 ? "s" : ""}`}
        />
        {section.subsections.map((sub) => (
          <Subsection key={sub.id} sub={sub} />
        ))}
      </div>
    </div>
  );
}
