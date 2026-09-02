import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { BACKEND } from "@/lib/api";
import { TID } from "@/constants/testIds";
import { useAIContext } from "@/context/AIContext";

const STARTER_PROMPTS = [
  "My hair has been thinning — where do I start?",
  "How do I sustainably lose belly fat?",
  "Something calming for stressful evenings?",
  "What does tulsi actually do?",
  "How is your makhana different from regular snacks?",
];

// 2-line trust-building intro. Kept short so it always fits above the fold.
const OPENING_LINE_1 = "Namaste. I'm the NileNest family guide.";
const OPENING_LINE_2 = "Ask me about any wellness concern, ingredient, or product — I'll give you an honest, point-to-point answer.";

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // greeting stays outside the log, always visible
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => `s-${Math.random().toString(36).slice(2, 10)}`);
  const scrollRef = useRef(null);
  const ai = useAIContext();

  useEffect(() => {
    if (ai) ai.registerOpener(() => setOpen(true));
  }, [ai]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, open]);

  const send = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setSending(true);
    try {
      const resp = await fetch(`${BACKEND}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId, context_product_id: ai?.getProduct() || null }),
      });
      if (!resp.ok || !resp.body) throw new Error("Chat failed");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const p of parts) {
          if (p.startsWith("event: done")) continue;
          const line = p.replace(/^data:\s?/, "");
          if (line === "{}" || !line) continue;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + line };
            return copy;
          });
        }
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Sorry — I'm briefly unavailable. Please try again in a moment." };
        return copy;
      });
    } finally {
      setSending(false);
    }
  };

  const contextLabel = ai?.getProduct()
    ? "Talking about the product you're viewing"
    : "Family wellness guide · Not a medical advisor";
  const showStarters = messages.length === 0 && !sending;

  return (
    <>
      <button data-testid={TID.ai.fab} onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-secondary text-secondary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-50"
        aria-label="Open wellness guide">
        <MessageCircle className="w-6 h-6" />
      </button>
      {open && (
        <div role="dialog" aria-label="NileNest Wellness Guide chat" className="fixed bottom-24 right-6 w-[92vw] sm:w-[420px] max-h-[76vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col z-50 animate-fade-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 flex-none">
            <div>
              <div className="font-display text-lg flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-secondary" /> Wellness Guide
              </div>
              <div className="text-[10px] tracking-widest uppercase text-muted-foreground">{contextLabel}</div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-accent rounded-full"><X className="w-4 h-4" /></button>
          </div>

          {/* PINNED greeting — always visible, does not scroll away */}
          <div className="px-4 py-3 border-b border-border/60 bg-accent/40 flex-none">
            <div className="font-display text-base leading-snug text-primary">{OPENING_LINE_1}</div>
            <div className="text-xs leading-relaxed text-muted-foreground mt-1">{OPENING_LINE_2}</div>
          </div>

          {/* Scrollable log — starters or messages */}
          <div ref={scrollRef} data-testid={TID.ai.log} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            {showStarters && (
              <>
                <div className="text-[10px] tracking-widest uppercase text-muted-foreground">Try asking</div>
                <div className="flex flex-wrap gap-2">
                  {STARTER_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      data-testid={`starter-${p.slice(0, 12).replace(/\s+/g, "-").toLowerCase()}`}
                      className="text-left text-xs px-3 py-2 border border-border rounded-full hover:border-secondary hover:text-secondary transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[88%] rounded-2xl px-3 py-2 whitespace-pre-wrap leading-relaxed ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
                {m.content || (sending && i === messages.length - 1 ? <span className="opacity-60">…</span> : "")}
              </div>
            ))}
          </div>

          <div className="border-t border-border/60 px-3 pt-3 pb-2 flex-none">
            <div className="flex gap-2">
              <input data-testid={TID.ai.input} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask about hair, digestion, sleep, an ingredient…"
                className="flex-1 bg-transparent px-3 py-2 border border-border rounded-full text-sm focus:outline-none focus:border-secondary" />
              <button data-testid={TID.ai.send} onClick={() => send()} disabled={sending}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              Educational guidance only — not medical advice. For symptoms, please consult a qualified professional.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
