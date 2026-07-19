"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  BrainCircuit,
  Braces,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Database,
  FileCheck2,
  FileCode2,
  GitCommitHorizontal,
  History,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  TestTube2,
  UserRound,
  WandSparkles,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentProposal, RepoFile, RepositoryState } from "../lib/types";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  body: string;
  meta?: string;
};

type TimelineEvent = {
  id: string;
  stage: string;
  detail: unknown;
};

const INITIAL_PROMPT = "Add a /health endpoint with a test.";
const FRESH_PROMPT = "Add a /version endpoint with a test.";

const initialMessages: ChatMessage[] = [
  {
    id: "hello",
    role: "assistant",
    body: "Repository loaded. I can add endpoints, write tests, and run the suite.",
    meta: "Clean session · no learned conventions",
  },
];

const timelineMeta: Record<
  string,
  { label: string; eyebrow: string; icon: LucideIcon; tone: string }
> = {
  diagnosing: {
    label: "Diagnosing the correction",
    eyebrow: "01 · Understand",
    icon: BrainCircuit,
    tone: "violet",
  },
  rule: {
    label: "General rule inferred",
    eyebrow: "02 · Generalize",
    icon: Sparkles,
    tone: "violet",
  },
  writing_eval: {
    label: "Regression eval written",
    eyebrow: "03 · Generate",
    icon: FileCode2,
    tone: "blue",
  },
  eval_before: {
    label: "Bad code caught",
    eyebrow: "04 · Prove negative",
    icon: X,
    tone: "red",
  },
  eval_after: {
    label: "Human fix passes",
    eyebrow: "05 · Prove positive",
    icon: Check,
    tone: "green",
  },
  regressions: {
    label: "Zero regressions",
    eyebrow: "06 · Protect",
    icon: ShieldCheck,
    tone: "green",
  },
  committing: {
    label: "Committing memory",
    eyebrow: "07 · Remember",
    icon: GitCommitHorizontal,
    tone: "amber",
  },
  done: {
    label: "Memory is live",
    eyebrow: "Verified & committed",
    icon: CheckCircle2,
    tone: "green",
  },
  fresh_session: {
    label: "Fresh agent session",
    eyebrow: "No conversation context",
    icon: RefreshCw,
    tone: "blue",
  },
  prevented: {
    label: "Mistake prevented",
    eyebrow: "First try · memory applied",
    icon: Zap,
    tone: "green",
  },
  error: {
    label: "Loop interrupted",
    eyebrow: "Needs attention",
    icon: X,
    tone: "red",
  },
};

function detailText(event: TimelineEvent) {
  const detail = event.detail;
  if (event.stage === "rule" && detail && typeof detail === "object") {
    return String((detail as { statement?: string }).statement ?? "Rule ready");
  }
  if (event.stage === "writing_eval" && detail && typeof detail === "object") {
    return String((detail as { filename?: string }).filename ?? "Eval generated");
  }
  if (event.stage === "eval_before") return "The new eval fails on the agent's original patch.";
  if (event.stage === "eval_after") return "The same eval passes on the human correction.";
  if (event.stage === "regressions" && detail && typeof detail === "object") {
    const value = detail as { count?: number; baselineTests?: number };
    return `${value.baselineTests ?? 24}/${value.baselineTests ?? 24} baseline tests pass · ${value.count ?? 0} regressions`;
  }
  if (event.stage === "done") return "AGENTS.md, Codex Skill, and eval committed.";
  if (event.stage === "fresh_session") return "Previous response state cleared. Repository memory remains.";
  if (event.stage === "prevented") return "pytest + structlog applied before code was written.";
  if (typeof detail === "string") return detail.replaceAll("_", " ");
  return "Reflex is working through this stage.";
}

function correctedFiles(files: RepoFile[]) {
  return files.map((file) => {
    if (file.path === "app.py") {
      return {
        ...file,
        content: file.content.replace(
          '    print("health check")',
          '    log.info("health_checked", status="ok")',
        ),
      };
    }

    if (file.path === "tests/test_health.py" && file.content.includes("unittest")) {
      return {
        ...file,
        content: `from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
`,
      };
    }

    return file;
  });
}

function sameFiles(left: RepoFile[], right: RepoFile[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function CodeBlock({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <pre className="code-block" aria-label="Read-only code">
      {lines.map((line, index) => (
        <span className="code-line" key={`${index}-${line}`}>
          <span className="line-number">{String(index + 1).padStart(2, "0")}</span>
          <code>{line || " "}</code>
        </span>
      ))}
    </pre>
  );
}

export default function ReflexApp() {
  const [state, setState] = useState<RepositoryState | null>(null);
  const [view, setView] = useState<"workspace" | "memory">("workspace");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [prompt, setPrompt] = useState(INITIAL_PROMPT);
  const [lastPrompt, setLastPrompt] = useState(INITIAL_PROMPT);
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const [editedFiles, setEditedFiles] = useState<RepoFile[]>([]);
  const [activeFile, setActiveFile] = useState("app.py");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [working, setWorking] = useState(false);
  const [looping, setLooping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const refreshState = useCallback(async () => {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load the demo repository.");
    setState((await response.json()) as RepositoryState);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshState().catch((error) => setNotice(error.message));
    }, 0);
    return () => {
      window.clearTimeout(timer);
      eventSourceRef.current?.close();
    };
  }, [refreshState]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, working]);

  const activeProposal = proposal?.files.find((file) => file.path === activeFile);
  const activeEdit = editedFiles.find((file) => file.path === activeFile);
  const hasCorrection = proposal ? !sameFiles(proposal.files, editedFiles) : false;
  const learned = Boolean(state?.rules.length);

  const runAgent = async (freshSession = false, explicitPrompt?: string) => {
    const requestPrompt = explicitPrompt ?? prompt.trim();
    if (!requestPrompt || working || looping) return;

    setWorking(true);
    setNotice(null);
    setView("workspace");
    setProposal(null);
    setEditedFiles([]);
    setLastPrompt(requestPrompt);
    setMessages((items) => [
      ...items,
      { id: crypto.randomUUID(), role: "user", body: requestPrompt },
    ]);

    if (freshSession) {
      setTimeline((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          stage: "fresh_session",
          detail: "Brand-new response chain",
        },
      ]);
    }

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: requestPrompt, freshSession }),
      });
      const payload = (await response.json()) as { proposal?: AgentProposal; error?: string };
      if (!response.ok || !payload.proposal) throw new Error(payload.error ?? "Agent turn failed.");

      setProposal(payload.proposal);
      setEditedFiles(payload.proposal.files.map((file) => ({ ...file })));
      setActiveFile(payload.proposal.files[0]?.path ?? "app.py");
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          body: payload.proposal?.explanation ?? "Patch ready.",
          meta: payload.proposal?.testSummary,
        },
      ]);

      if (payload.proposal.memoryApplied) {
        setTimeline((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            stage: "prevented",
            detail: "The learned convention changed the first attempt",
          },
        ]);
        await refreshState();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Agent turn failed.");
    } finally {
      setWorking(false);
    }
  };

  const applyHumanCorrection = () => {
    if (!proposal) return;
    setEditedFiles(correctedFiles(proposal.files));
    setMessages((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role: "user",
        body: "Use pytest functions and the existing structlog logger — no unittest or print().",
        meta: "Human correction",
      },
    ]);
  };

  const streamReflex = (correctionId: string) => {
    eventSourceRef.current?.close();
    setTimeline([]);
    setLooping(true);
    const source = new EventSource(`/api/reflex?correctionId=${encodeURIComponent(correctionId)}`);
    eventSourceRef.current = source;

    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as { stage: string; detail: unknown };
      setTimeline((items) => [
        ...items,
        { id: crypto.randomUUID(), stage: event.stage, detail: event.detail },
      ]);

      if (event.stage === "done") {
        const detail = event.detail as { state?: RepositoryState };
        if (detail.state) setState(detail.state);
        setLooping(false);
        source.close();
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            body: "Correction verified. I wrote the rule, regression eval, and Codex Skill to repository memory.",
            meta: "Reflex memory committed",
          },
        ]);
      }

      if (event.stage === "error" || event.stage === "verification_failed") {
        setLooping(false);
        source.close();
        setNotice("The verification loop could not safely commit this correction.");
      }
    };

    source.onerror = () => {
      source.close();
      setLooping(false);
    };
  };

  const acceptCorrection = async () => {
    if (!proposal || !hasCorrection || looping) return;
    setLooping(true);
    setNotice(null);
    try {
      const response = await fetch("/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: lastPrompt,
          beforeFiles: proposal.files,
          afterFiles: editedFiles,
        }),
      });
      const payload = (await response.json()) as { correctionId?: string; error?: string };
      if (!response.ok || !payload.correctionId) {
        throw new Error(payload.error ?? "Could not capture the correction.");
      }
      streamReflex(payload.correctionId);
    } catch (error) {
      setLooping(false);
      setNotice(error instanceof Error ? error.message : "Could not capture the correction.");
    }
  };

  const startFreshSession = () => {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        body: "Fresh session started. I only know what the repository tells me.",
        meta: "No prior conversation state",
      },
    ]);
    setPrompt(FRESH_PROMPT);
    setProposal(null);
    setEditedFiles([]);
    void runAgent(true, FRESH_PROMPT);
  };

  const resetDemo = async () => {
    if (working || looping) return;
    setWorking(true);
    setNotice(null);
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      const payload = (await response.json()) as { state?: RepositoryState; error?: string };
      if (!response.ok || !payload.state) throw new Error(payload.error ?? "Reset failed.");
      setState(payload.state);
      setMessages(initialMessages);
      setPrompt(INITIAL_PROMPT);
      setLastPrompt(INITIAL_PROMPT);
      setProposal(null);
      setEditedFiles([]);
      setTimeline([]);
      setView("workspace");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setWorking(false);
    }
  };

  const updateActiveFile = (content: string) => {
    setEditedFiles((files) =>
      files.map((file) => (file.path === activeFile ? { ...file, content } : file)),
    );
  };

  const copyText = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const apiLabel = state?.apiMode === "live" ? "GPT-5.6 Sol live" : "Showcase mode";
  const apiClass = state?.apiMode === "live" ? "live" : "showcase";
  const done = timeline.some((event) => event.stage === "done");

  if (!state) {
    return (
      <main className="loading-screen">
        <div className="brandmark large">R</div>
        <LoaderCircle className="spin" aria-hidden="true" />
        <p>Loading the Reflex sandbox…</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brandmark">R</div>
          <div>
            <div className="brand-name">Reflex</div>
            <div className="brand-tagline">Correct once. Never again.</div>
          </div>
        </div>

        <nav className="view-tabs" aria-label="Reflex views">
          <button
            className={view === "workspace" ? "active" : ""}
            onClick={() => setView("workspace")}
          >
            <TerminalSquare aria-hidden="true" /> Workspace
          </button>
          <button
            className={view === "memory" ? "active" : ""}
            onClick={() => setView("memory")}
          >
            <History aria-hidden="true" /> Memory
            {state.rules.length > 0 && <span className="nav-count">{state.rules.length}</span>}
          </button>
        </nav>

        <div className="topbar-actions">
          <div className={`api-pill ${apiClass}`} title="OpenAI runtime mode">
            <span className="pulse-dot" />
            {apiLabel}
          </div>
          <button className="icon-button" onClick={resetDemo} aria-label="Reset demo" title="Reset demo">
            <RotateCcw aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="metrics-strip" aria-label="Repository metrics">
        <div className="repo-breadcrumb">
          <Database aria-hidden="true" />
          <span>reflex-labs</span>
          <span className="slash">/</span>
          <strong>fastapi-demo</strong>
          <span className="branch-pill"><GitCommitHorizontal /> main</span>
        </div>
        <div className="metric-group">
          <div className="metric">
            <span className="metric-label">Baseline suite</span>
            <strong><CheckCircle2 /> 24/24</strong>
          </div>
          <div className="metric emphasis">
            <span className="metric-label">Mistakes prevented</span>
            <strong><Zap /> {state.mistakesPrevented}</strong>
          </div>
          <div className="metric">
            <span className="metric-label">Agent sessions</span>
            <strong><Layers3 /> {state.sessions + 1}</strong>
          </div>
        </div>
      </section>

      {notice && (
        <div className="notice" role="alert">
          <Activity aria-hidden="true" />
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss message"><X /></button>
        </div>
      )}

      {view === "workspace" ? (
        <section className="workspace-grid">
          <aside className="panel chat-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Agent</span>
                <h2>Build session</h2>
              </div>
              <span className="session-chip"><Circle /> Session {state.sessions + 1}</span>
            </div>

            <div className="chat-scroll">
              {messages.map((message) => (
                <motion.article
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={message.id}
                  className={`message ${message.role}`}
                >
                  <div className="message-avatar">
                    {message.role === "assistant" ? <Bot /> : <UserRound />}
                  </div>
                  <div className="message-content">
                    <div className="message-role">{message.role === "assistant" ? "Reflex Agent" : "You"}</div>
                    <p>{message.body}</p>
                    {message.meta && <span className="message-meta">{message.meta}</span>}
                  </div>
                </motion.article>
              ))}
              {working && (
                <div className="message assistant">
                  <div className="message-avatar"><Bot /></div>
                  <div className="message-content">
                    <div className="message-role">Reflex Agent</div>
                    <div className="typing"><span /><span /><span /></div>
                    <span className="message-meta">Inspecting repository · running tools</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="prompt-area">
              {!proposal && !learned && (
                <button className="suggested-prompt" onClick={() => setPrompt(INITIAL_PROMPT)}>
                  <Sparkles /> Demo prompt <ArrowRight />
                </button>
              )}
              <label className="prompt-box">
                <span className="sr-only">Prompt the coding agent</span>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void runAgent();
                  }}
                  placeholder="Ask the agent to change the repository…"
                  rows={3}
                />
                <div className="prompt-footer">
                  <span>⌘ Enter to run</span>
                  <button
                    className="send-button"
                    disabled={!prompt.trim() || working || looping}
                    onClick={() => void runAgent()}
                    aria-label="Run agent"
                  >
                    {working ? <LoaderCircle className="spin" /> : <Send />}
                  </button>
                </div>
              </label>
            </div>
          </aside>

          <section className="panel diff-panel">
            <div className="panel-header diff-header">
              <div>
                <span className="panel-kicker">Human checkpoint</span>
                <h2>Patch review</h2>
              </div>
              {proposal && (
                <div className="patch-summary">
                  <span className="additions">+{editedFiles.reduce((sum, file) => sum + file.content.split("\n").length, 0)}</span>
                  <span>{proposal.files.length} files</span>
                </div>
              )}
            </div>

            {!proposal ? (
              <div className="empty-patch">
                <div className="empty-visual">
                  <FileCode2 />
                  <span className="scan-line" />
                </div>
                <span className="eyebrow">Waiting for a change</span>
                <h3>Run the demo prompt</h3>
                <p>The agent&apos;s patch will appear here for review and one human correction.</p>
                <button className="primary-button compact" onClick={() => void runAgent(false, INITIAL_PROMPT)} disabled={working}>
                  <Play /> Run “Add /health”
                </button>
              </div>
            ) : (
              <>
                <div className="file-tabs" role="tablist" aria-label="Changed files">
                  {proposal.files.map((file) => (
                    <button
                      key={file.path}
                      className={activeFile === file.path ? "active" : ""}
                      onClick={() => setActiveFile(file.path)}
                      role="tab"
                      aria-selected={activeFile === file.path}
                    >
                      <Braces /> {file.path}
                      {editedFiles.find((item) => item.path === file.path)?.content !== file.content && (
                        <span className="edited-dot" title="Human edited" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="review-columns">
                  <div className="review-column">
                    <div className="review-label">
                      <span><Bot /> Agent wrote</span>
                      <span className="review-state bad">Needs correction</span>
                    </div>
                    <div className="code-shell bad-code">
                      <CodeBlock code={activeProposal?.content ?? ""} />
                    </div>
                  </div>
                  <div className="review-column">
                    <div className="review-label">
                      <span><UserRound /> Your accepted version</span>
                      <span className={`review-state ${hasCorrection ? "good" : "neutral"}`}>
                        {hasCorrection ? "Corrected" : "Editable"}
                      </span>
                    </div>
                    <textarea
                      className="code-editor"
                      value={activeEdit?.content ?? ""}
                      onChange={(event) => updateActiveFile(event.target.value)}
                      spellCheck={false}
                      aria-label={`Edit ${activeFile}`}
                    />
                  </div>
                </div>

                <div className="review-footer">
                  <div className="test-status">
                    <CheckCircle2 />
                    <div>
                      <strong>{proposal.testSummary}</strong>
                      <span>Sandbox · network off · 1.2s</span>
                    </div>
                  </div>
                  <div className="review-actions">
                    {!proposal.memoryApplied && (
                      <button className="secondary-button" onClick={applyHumanCorrection} disabled={looping}>
                        <WandSparkles /> Correct once
                      </button>
                    )}
                    <button
                      className="primary-button"
                      onClick={acceptCorrection}
                      disabled={!hasCorrection || looping || proposal.memoryApplied}
                    >
                      {looping ? <LoaderCircle className="spin" /> : <ShieldCheck />}
                      {looping ? "Reflex is learning…" : proposal.memoryApplied ? "Correct on first try" : "Accept with correction"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="panel timeline-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">The Reflex loop</span>
                <h2>Verified memory</h2>
              </div>
              <div className={`loop-state ${looping ? "running" : done ? "complete" : "idle"}`}>
                {looping ? <LoaderCircle className="spin" /> : done ? <Check /> : <Activity />}
                {looping ? "Running" : done ? "Committed" : "Ready"}
              </div>
            </div>

            <div className="timeline-scroll">
              {timeline.length === 0 ? (
                <div className="timeline-empty">
                  <div className="loop-orbit">
                    <div className="orbit-core"><BrainCircuit /></div>
                    <span className="orbit-dot one" />
                    <span className="orbit-dot two" />
                    <span className="orbit-dot three" />
                  </div>
                  <h3>One correction becomes memory</h3>
                  <p>Reflex will diagnose, generate an eval, prove it, and commit the rule.</p>
                  <div className="stage-preview">
                    <span><BrainCircuit /> Diagnose</span>
                    <ArrowRight />
                    <span><TestTube2 /> Verify</span>
                    <ArrowRight />
                    <span><GitCommitHorizontal /> Commit</span>
                  </div>
                </div>
              ) : (
                <div className="timeline-list">
                  <AnimatePresence initial={false}>
                    {timeline.map((event, index) => {
                      const meta = timelineMeta[event.stage] ?? timelineMeta.diagnosing;
                      const Icon = meta.icon;
                      return (
                        <motion.article
                          key={event.id}
                          initial={{ opacity: 0, x: 18, scale: 0.97 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 24 }}
                          className={`timeline-item ${meta.tone}`}
                        >
                          <div className="timeline-rail">
                            <div className="stage-icon"><Icon /></div>
                            {index < timeline.length - 1 && <span className="rail-line" />}
                          </div>
                          <div className="stage-copy">
                            <span className="stage-eyebrow">{meta.eyebrow}</span>
                            <h3>{meta.label}</h3>
                            <p>{detailText(event)}</p>
                            {event.stage === "rule" && (
                              <span className="verified-badge"><ShieldCheck /> Generalizable</span>
                            )}
                          </div>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {done && !timeline.some((event) => event.stage === "prevented") && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="fresh-proof-card"
              >
                <div><RefreshCw /><span>Proof step</span></div>
                <h3>Now clear the conversation.</h3>
                <p>Start a new agent session and watch repository memory prevent the mistake.</p>
                <button className="proof-button" onClick={startFreshSession} disabled={working}>
                  Start fresh session <ArrowRight />
                </button>
              </motion.div>
            )}
          </aside>
        </section>
      ) : (
        <section className="memory-view">
          <div className="memory-heading">
            <div>
              <span className="panel-kicker">Repository-owned intelligence</span>
              <h1>Memory that survives the session.</h1>
              <p>Every committed lesson is readable by humans, coding agents, and CI.</p>
            </div>
            <div className="memory-score">
              <div className="score-ring">{state.rules.length}</div>
              <div><strong>verified rule{state.rules.length === 1 ? "" : "s"}</strong><span>from one correction</span></div>
            </div>
          </div>

          <div className="memory-grid">
            <article className="memory-card agents-card">
              <div className="memory-card-header">
                <div className="file-identity"><FileCheck2 /><div><span>Repository memory</span><strong>AGENTS.md</strong></div></div>
                <button onClick={() => void copyText("agents", state.agentsMd)} aria-label="Copy AGENTS.md">
                  {copied === "agents" ? <Check /> : <Copy />}
                </button>
              </div>
              <CodeBlock code={state.agentsMd} />
              {state.rules.length === 0 && (
                <div className="empty-memory"><LockKeyhole /><span>No conventions learned yet. Complete the correction loop.</span></div>
              )}
            </article>

            <article className="memory-card skill-card">
              <div className="memory-card-header">
                <div className="file-identity"><Sparkles /><div><span>Reusable workflow</span><strong>.codex/skills/repository-conventions/SKILL.md</strong></div></div>
                {state.skillMd && (
                  <button onClick={() => void copyText("skill", state.skillMd)} aria-label="Copy skill">
                    {copied === "skill" ? <Check /> : <Copy />}
                  </button>
                )}
              </div>
              {state.skillMd ? <CodeBlock code={state.skillMd} /> : <div className="memory-placeholder"><Sparkles /><p>The generated Codex Skill will appear here after verification.</p></div>}
            </article>

            <article className="memory-card eval-card">
              <div className="memory-card-header">
                <div className="file-identity"><TestTube2 /><div><span>Executable proof</span><strong>{state.rules[0]?.evalFilename ?? "tests/test_repository_conventions.py"}</strong></div></div>
                <span className="status-badge"><CheckCircle2 /> {state.rules.length ? "Passing" : "Pending"}</span>
              </div>
              {state.rules[0] ? <CodeBlock code={state.rules[0].evalCode} /> : <div className="memory-placeholder"><TestTube2 /><p>Reflex writes an eval that must fail before and pass after.</p></div>}
            </article>

            <article className="memory-card ledger-card">
              <div className="memory-card-header">
                <div className="file-identity"><History /><div><span>Learning ledger</span><strong>Verified corrections</strong></div></div>
              </div>
              {state.rules.length ? (
                <div className="ledger-list">
                  {state.rules.map((rule) => (
                    <div className="ledger-item" key={rule.id}>
                      <div className="ledger-icon"><GitCommitHorizontal /></div>
                      <div><strong>{rule.statement}</strong><p>{rule.rationale}</p><span>{new Date(rule.createdAt).toLocaleString()} · committed</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="memory-placeholder"><History /><p>No corrections have been committed.</p></div>
              )}
            </article>
          </div>
        </section>
      )}

      <footer className="app-footer">
        <span><span className="pulse-dot" /> Sandbox isolated</span>
        <span>Responses API · Structured Outputs · D1 memory</span>
        <span>Last event: {state.lastEvent}</span>
      </footer>
    </main>
  );
}
