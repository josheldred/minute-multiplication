import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Minute Multiplication — Kid Mode (3rd Grade)
 * Fully self‑contained React + TypeScript app.
 *
 * Fixes in this revision:
 * - **SyntaxError after `endRound()`**: removed stray duplicate lines and an extra closing brace
 *   that broke parsing around the `startRound`/`endRound` region.
 * - Cleaned conditional rendering of the end-of-round modal and bottom results to avoid
 *   chained `&&` expressions that can be brittle.
 * - Kept all features you requested (wrong‑twice logic, end modal, Frogger close button,
 *   lane spacing and speeds, etc.).
 */

// ---------------------- Types ---------------------------------------------
type Problem = { a: number; b: number; ans: number };
type Attempt = { a: number; b: number; ans: number; resp: number; correct: boolean };
type Frog = { r: number; c: number; hopping: boolean };
type Car = { row: number; x: number; w: number; speed: number; dir: number; hue: number };

// ---------------------- Constants & helpers -------------------------------
const ALL_FAMILIES = Array.from({ length: 13 }, (_, i) => i); // 0..12
const MULTIPLIERS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12

function choice<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]!; }
function selectionKey(families: number[]): string { return families.slice().sort((a, b) => a - b).join(","); }
function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function clampInt(v: string | number, min: number, max: number): number { const n = Math.round(Number(v)); if (!Number.isFinite(n)) return min; return Math.max(min, Math.min(max, n)); }

// Problem generator (module-scope so tests can call it)
function genRandomProblem(families: number[]): Problem { const a = choice(families); const b = choice(MULTIPLIERS); return { a, b, ans: a * b }; }

// ---------------------- Hooks ---------------------------------------------
function useInterval(callback: () => void, delay: number | null) {
  const savedRef = useRef(callback);
  useEffect(() => { savedRef.current = callback; }, [callback]);
  useEffect(() => {
    if (delay == null) return;
    const id = setInterval(() => savedRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function useRaf(callback: (dt: number) => void, active: boolean) {
  const cbRef = useRef(callback);
  const frameRef = useRef<number | null>(null);
  useEffect(() => { cbRef.current = callback; }, [callback]);
  useEffect(() => {
    if (!active) return;
    let prev = performance.now();
    const loop = (now: number) => {
      const dt = (now - prev) / 1000; // seconds
      prev = now;
      cbRef.current?.(dt);
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current != null) cancelAnimationFrame(frameRef.current); };
  }, [active]);
}

// ---------------------- Tiny Sound Synth ----------------------------------
let _audioCtx: AudioContext | undefined;
function getCtx(): AudioContext {
  if (!_audioCtx) {
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    _audioCtx = new AC();
  }
  return _audioCtx!;
}
function beep({ freq = 600, dur = 0.12, type = "sine", gain = 0.05 }: { freq?: number; dur?: number; type?: OscillatorType; gain?: number }) {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = gain;
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime; o.start(t); o.stop(t + dur);
  } catch {}
}
function chordSuccess() { beep({ freq: 660, dur: 0.08, type: "triangle" }); setTimeout(() => beep({ freq: 880, dur: 0.08, type: "triangle" }), 90); }
function buzzWrong() { beep({ freq: 180, dur: 0.12, type: "square", gain: 0.04 }); }
function fanfareNewBest() { [660, 880, 1320].forEach((f, i) => setTimeout(() => beep({ freq: f, dur: 0.1, type: "sawtooth" }), i * 90)); }

// ---------------------- Confetti (intense) --------------------------------
function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  const N = 200; // many pieces
  const palette = ["#f59e0b", "#10b981", "#6366f1", "#ef4444", "#06b6d4", "#f472b6", "#84cc16"];
  const emoji = ['🎉','✨','⭐️','💥','🎈','🟡','🟣','🟠'];
  const pieces = Array.from({ length: N }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    dur: 1.4 + Math.random() * 1.2,
    size: 8 + Math.floor(Math.random() * 16),
    type: Math.random() < 0.6 ? 'shape' : 'emoji' as const,
    color: choice(palette),
    char: choice(emoji),
  }));
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      {pieces.map((p) => (
        p.type === 'emoji' ? (
          <span
            key={p.id}
            className="absolute animate-confetti"
            style={{ left: `${p.left}%`, fontSize: `${p.size}px`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}
          >{p.char}</span>
        ) : (
          <div
            key={p.id}
            className="absolute animate-confetti rounded-md shadow"
            style={{ left: `${p.left}%`, width: `${p.size}px`, height: `${p.size}px`, background: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}
          />
        )
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-fuchsia-400/70 animate-ring" />
      </div>
      <style>{`
        @keyframes confettiFall { 0% { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 1; } 100% { transform: translate3d(0, 110vh, 0) rotate(720deg); opacity: 0; } }
        .animate-confetti { animation: confettiFall var(--dur,1.6s) ease-out forwards; }
        @keyframes ring { 0% { transform: scale(0.2); opacity: 0.9; } 100% { transform: scale(2.2); opacity: 0; } }
        .animate-ring { animation: ring 0.9s ease-out forwards; }
      `}</style>
    </div>
  );
}

// ---------------------- UI Elements ---------------------------------------
function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        `px-3 py-2 rounded-2xl border text-sm sm:text-base font-bold transition select-none shadow-sm ` +
        (active
          ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white border-emerald-600 shadow-lg"
          : "bg-white text-indigo-900 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50")
      }
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={"flex flex-col items-center p-3 rounded-2xl bg-white/90 shadow-md border"}>
      <div className="text-3xl font-black tabular-nums">{value}</div>
      <div className="text-xs text-gray-600 uppercase tracking-wide">{label}</div>
    </div>
  );
}

// ---------------------- Best score (per‑day per set) ----------------------
function bestKey(k: string) { return `minuteMult.best.${todayStr()}.${k || "none"}`; }
function useBestForKey(k: string): [number, (score: number) => boolean] {
  const [best, setBest] = useState<number>(() => Number(localStorage.getItem(bestKey(k)) || 0));
  useEffect(() => { setBest(Number(localStorage.getItem(bestKey(k)) || 0)); }, [k]);
  const update = (score: number) => {
    const cur = Number(localStorage.getItem(bestKey(k)) || 0);
    if (score > cur) { localStorage.setItem(bestKey(k), String(score)); setBest(score); return true; }
    return false;
  };
  return [best, update];
}

// ---------------------- Frogger 2.5D (spaced cars, variable speeds) -------
function FroggerGame({ onClose }: { onClose?: () => void }) {
  // Make board taller to support ~double the traffic lanes
  const COLS = 17;
  const ROWS = 16; // goal at 0, twelve traffic lanes 2..13, start grass at 15
  const CELL = 40;

  // Build 12 traffic lanes from row 2 to row 13 (top lanes should be faster)
  const LANE_ROWS = Array.from({ length: 12 }, (_, i) => i + 2); // [2..13]
  const DIRS = LANE_ROWS.map((_, i) => (i % 2 === 0 ? 1 : -1));

  // Speed profile: top lanes (smaller row) are faster; bottom are slower
  const SPEEDS = LANE_ROWS.map((_, i) => {
    const rank = (LANE_ROWS.length - i) / LANE_ROWS.length; // top ~1.0, bottom ~0.08
    return 2.0 + rank * 2.0; // 2.0 .. 4.0
  });

  // Slightly denser traffic overall by alternating 3 and 4 cars per lane
  const LANE_COUNTS = LANE_ROWS.map((_, i) => (i % 2 === 0 ? 4 : 3));

  const [frog, setFrog] = useState<Frog>({ r: ROWS - 1, c: Math.floor(COLS / 2), hopping: false });
  const targetRef = useRef<Frog>({ r: ROWS - 1, c: Math.floor(COLS / 2), hopping: false });
  const [alive, setAlive] = useState(true);
  const [won, setWon] = useState(false);

  // Car lanes (clean init)
  const carsRef = useRef<Car[][]>(
    LANE_ROWS.map((row, i) => {
      const count = LANE_COUNTS[i] as number;
      const spacing = (COLS / count) * 1.25; // slightly farther apart
      return Array.from({ length: count }, (_, k) => ({
        row,
        x: (k * spacing) % COLS,
        w: 1.6 + (k % 2) * 0.6,
        speed: SPEEDS[i]! * (0.9 + Math.random() * 0.2), // small per-car jitter
        dir: DIRS[i]!,
        hue: 200 + ((i * 25 + k * 40) % 160),
      }));
    })
  );

  const [, setFrame] = useState(0);

  // Arrow key controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { key } = e;
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) return;
      e.preventDefault();
      const next: Frog = {
        r: frog.r + (key==='ArrowUp'?-1:key==='ArrowDown'?1:0),
        c: frog.c + (key==='ArrowLeft'?-1:key==='ArrowRight'?1:0),
        hopping: true,
      };
      next.r = Math.max(0, Math.min(ROWS - 1, next.r));
      next.c = Math.max(0, Math.min(COLS - 1, next.c));
      targetRef.current = next;
      setFrog((f) => ({ ...f, hopping: true }));
    };
    window.addEventListener('keydown', onKey as any, { passive: false } as any);
    return () => window.removeEventListener('keydown', onKey as any);
  }, [frog.r, frog.c]);

  const hopProg = useRef(0);
  useRaf((dt) => {
    if (!alive || won) return;
    // Move cars every frame
    carsRef.current.forEach((lane) => {
      lane.forEach((car) => { car.x = (car.x + car.dir * car.speed * dt + COLS) % COLS; });
    });
    // Frog hop animation
    if (frog.hopping) {
      hopProg.current += dt * 6;
      if (hopProg.current >= 1) {
        hopProg.current = 0;
        setFrog({ r: targetRef.current.r, c: targetRef.current.c, hopping: false });
      } else {
        setFrog((f) => ({ ...f }));
      }
    }
    // force re-render
    setFrame((n) => (n + 1) % 1000000);

    // Collision + win
    const fr = frog.hopping ? lerp(frog.r, targetRef.current.r, easeOut(hopProg.current)) : frog.r;
    const fc = frog.hopping ? lerp(frog.c, targetRef.current.c, easeOut(hopProg.current)) : frog.c;
    const inLaneIdx = LANE_ROWS.indexOf(Math.round(fr));
    if (inLaneIdx >= 0) {
      const cars = carsRef.current[inLaneIdx]!;
      const hit = cars.some((car) => {
        const cx = wrap(car.x, COLS);
        const fx = wrap(fc, COLS);
        return fx >= cx && fx <= cx + car.w;
      });
      if (hit) setAlive(false);
    }
    if (Math.round(fr) === 0) setWon(true);
  }, true);

  useEffect(() => { if (!alive || won) setTimeout(() => onClose && onClose(), 1200); }, [alive, won, onClose]);

  // Helpers
  function wrap(x: number, m: number) { return ((x % m) + m) % m; }
  function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
  function easeOut(t: number) { return 1 - Math.pow(1 - t, 2); }

  const frogPos = (() => {
    const pr = frog.hopping ? lerp(frog.r, targetRef.current.r, easeOut(hopProg.current)) : frog.r;
    const pc = frog.hopping ? lerp(frog.c, targetRef.current.c, easeOut(hopProg.current)) : frog.c;
    return { top: pr * CELL, left: pc * CELL };
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-3xl shadow-2xl border border-indigo-200 overflow-hidden" style={{ perspective: 800 }}>
        <div className="relative" style={{ width: COLS * CELL, height: ROWS * CELL, transform: "rotateX(8deg) translateZ(0)" }}>
          {/* Close button for touch devices */}
          <button aria-label="Close" onClick={() => onClose && onClose()} className="absolute top-2 right-2 z-10 w-9 h-9 rounded-full bg-white/90 border border-indigo-200 text-indigo-800 font-bold shadow hover:bg-white">×</button>
          {/* Background */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(#b9f3c7, #b9f3c7)" }} />
          {/* Roads */}
          {LANE_ROWS.map((r, i) => (
            <div key={r} className="absolute left-0 right-0" style={{ top: r * CELL, height: CELL, background: i % 2 ? "linear-gradient(180deg,#cbd5e1,#94a3b8)" : "linear-gradient(180deg,#e2e8f0,#cbd5e1)" }}>
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 grid grid-cols-8 gap-6 opacity-60">
                {Array.from({ length: 8 }).map((_, k) => (<div key={k} className="h-1.5 bg-white rounded" />))}
              </div>
            </div>
          ))}
          {/* Goal + Start */}
          <div className="absolute left-0 right-0" style={{ top: 0, height: CELL, background: "linear-gradient(180deg,#fcd34d,#f59e0b)" }} />
          <div className="absolute left-0 right-0" style={{ top: CELL, height: CELL, background: "linear-gradient(180deg,#fde68a,#fbbf24)", opacity: 0.6 }} />
          <div className="absolute left-0 right-0" style={{ bottom: 0, height: CELL, background: "linear-gradient(180deg,#86efac,#22c55e)" }} />

          {/* Cars */}
          {carsRef.current.flat().map((car, idx) => (
            <div key={idx} className="absolute will-change-transform" style={{ top: car.row * CELL + 2, transform: `translateX(${wrap(car.x, COLS) * CELL}px)`, transition: "transform 0.05s linear" }}>
              <div className="relative" style={{ width: car.w * CELL, height: CELL - 4 }}>
                <div className="absolute inset-0 rounded-xl shadow-md" style={{ background: `linear-gradient(180deg,hsl(${car.hue} 80% 65%), hsl(${car.hue} 80% 40%))` }} />
                <div className="absolute left-1 right-1 top-1 h-1.5 rounded bg-white/70" />
                <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-black/70" />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-black/70" />
                <div className="absolute -bottom-1 left-2 right-2 h-1 rounded-full bg-black/20 blur-sm" />
              </div>
            </div>
          ))}

          {/* Frog */}
          <div className="absolute" style={{ top: frogPos.top, left: frogPos.left }}>
            <div className="relative" style={{ width: CELL, height: CELL }}>
              <div className="absolute inset-0 rounded-full shadow" style={{ background: "radial-gradient(circle at 30% 30%, #a7f3d0, #10b981)" }} />
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-16 h-3 rounded-full bg-black/20 blur-sm" />
              <div className="absolute left-1/4 top-3 w-3 h-3 rounded-full bg-emerald-900" />
              <div className="absolute right-1/4 top-3 w-3 h-3 rounded-full bg-emerald-900" />
            </div>
          </div>

          {/* HUD */}
          {!alive && <div className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-rose-600 drop-shadow">SPLAT! 💥</div>}
          {won && <div className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-emerald-600 drop-shadow">You made it! 🎉</div>}
        </div>
      </div>
    </div>
  );
}

// ---------------------- Main Component ------------------------------------
export default function MinuteMultiplicationApp() {
  const [selected, setSelected] = useState<number[]>([2, 3]);
  const [seconds, setSeconds] = useState<number>(60);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [running, setRunning] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [current, setCurrent] = useState<Problem>(() => genRandomProblem([2, 3]));
  const [lastResult, setLastResult] = useState<null | { score: number; best: number; key: string; stats: { correct: number; wrong: number; missed: Problem[] } }>(null);
  const [flash, setFlash] = useState<null | 'right' | 'wrong'>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [showFrogger, setShowFrogger] = useState<boolean>(false);
  const [showEndModal, setShowEndModal] = useState<boolean>(false);
  const [wrongStreak, setWrongStreak] = useState<number>(0);

  // Missed‑fact handling between rounds
  const [missedQueueUI, setMissedQueueUI] = useState<Problem[]>([]);
  const missedQueueRef = useRef<Problem[]>([]);
  const setMissedQueue = (arr: Problem[]) => { missedQueueRef.current = Array.isArray(arr) ? arr.slice() : []; setMissedQueueUI(missedQueueRef.current.slice()); };

  const key = useMemo(() => selectionKey(selected), [selected]);
  const [best, updateBest] = useBestForKey(key);

  // Refs for focus control
  const answerRef = useRef<HTMLInputElement | null>(null);

  useInterval(() => {
    if (!running) return;
    setTimeLeft((t) => {
      if (t <= 1) { endRound(); return 0; }
      return t - 1;
    });
  }, running ? 1000 : null);

  // Always focus the answer field when a round is running and the problem changes
  useEffect(() => { if (running && answerRef.current) answerRef.current.focus(); }, [running, current]);

  function genNextProblem(): Problem {
    if (missedQueueRef.current.length && Math.random() < 0.6) {
      const next = missedQueueRef.current.shift()!;
      setMissedQueueUI(missedQueueRef.current.slice());
      return next;
    }
    return genRandomProblem(selected);
  }

  function startRound() {
    if (selected.length === 0) return;
    const seedMissed = lastResult?.stats?.missed?.map(m => ({ a: m.a, b: m.b, ans: m.ans })) || [];
    setMissedQueue(seedMissed);
    setScore(0);
    setAttempts([]);
    setTimeLeft(seconds);
    const first = seedMissed.length ? seedMissed[0] : genRandomProblem(selected);
    if (seedMissed.length) {
      missedQueueRef.current.shift();
      setMissedQueueUI(missedQueueRef.current.slice());
    }
    setCurrent(first);
    setRunning(true);
    setLastResult(null);
    setFlash(null);
    setWrongStreak(0);
    setShowEndModal(false);
    // Focus answer immediately
    setTimeout(() => answerRef.current?.focus(), 0);
  }

  function endRound() {
    setRunning(false);
    const newBest = updateBest(score);
    const stats = buildStats(attempts);
    setLastResult({ score, best: Math.max(best, score), key, stats });
    setShowEndModal(true);
    if (newBest) {
      setShowConfetti(true); fanfareNewBest();
      setTimeout(() => setShowConfetti(false), 1600);
      setShowFrogger(true);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!running) return;
    const form = new FormData(e.currentTarget);
    const valRaw = form.get("answer");
    const value = Number(valRaw);
    const input = e.currentTarget.querySelector("input");

    if (!Number.isFinite(value)) { input?.classList.add("animate-shake"); flashWrong(); answerRef.current?.focus(); return; }

    const correct = value === current.ans;
    setAttempts((arr) => [...arr, { a: current.a, b: current.b, ans: current.ans, resp: value, correct }]);

    if (correct) {
      setScore((s) => s + 1);
      const next = genNextProblem();
      setCurrent(next);
      e.currentTarget.reset();
      setWrongStreak(0);
      flashRight(); chordSuccess();
      answerRef.current?.focus();
    } else {
      const newStreak = wrongStreak + 1;
      (input as HTMLInputElement | null)?.classList.add("animate-shake");
      flashWrong(); buzzWrong();
      if (newStreak >= 2) {
        // Deduct one point (non-negative; say the word if you want negatives allowed)
        setScore((s) => Math.max(0, s - 1));
        const next = genNextProblem();
        setCurrent(next);
        e.currentTarget.reset();
        setWrongStreak(0);
      } else {
        setWrongStreak(newStreak);
      }
      answerRef.current?.focus();
    }
  }

  function flashRight() { setFlash("right"); setTimeout(() => setFlash(null), 160); }
  function flashWrong() { setFlash("wrong"); setTimeout(() => setFlash(null), 200); }

  function toggleFamily(n: number) { setSelected((prev) => prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]); }
  function selectAll() { setSelected(ALL_FAMILIES); }
  function clearAll() { setSelected([]); }
  function sameSetPlayAgain() { startRound(); }

  const flashRing = flash === "right" ? "ring-4 ring-emerald-400" : flash === "wrong" ? "ring-4 ring-rose-500" : "ring-0";

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-100 via-pink-100 to-amber-100 text-indigo-950 relative overflow-hidden">
      {/* Decorative bubbles */}
      <div className="pointer-events-none absolute -top-10 -left-10 w-72 h-72 rounded-full bg-pink-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-10 w-96 h-96 rounded-full bg-emerald-300/30 blur-3xl" />

      <Confetti show={showConfetti} />
      {showFrogger && <FroggerGame onClose={() => setShowFrogger(false)} />}

      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-fuchsia-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">✨ Minute Multiplication</h1>
          <div className="flex items-center gap-2">
            <label className="text-sm text-indigo-700 font-semibold" htmlFor="seconds">Seconds</label>
            <input id="seconds" type="number" min={10} max={300} value={seconds} onChange={(e) => setSeconds(clampInt(e.target.value, 10, 300))} className="w-20 rounded-xl border border-indigo-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
            <button onClick={() => setTimeLeft(seconds)} className="text-sm underline text-indigo-700 hover:text-indigo-900" disabled={running} title="Sync timer with Seconds">Reset</button>
          </div>
        </header>

        {/* Fact family selection */}
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-extrabold text-indigo-900">Pick your fact families (0–12)</h2>
            <div className="flex gap-2 text-sm">
              <button onClick={selectAll} className="underline font-semibold text-indigo-800">Select all</button>
              <button onClick={clearAll} className="underline font-semibold text-indigo-800">Clear</button>
            </div>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-13 gap-2">
            {ALL_FAMILIES.map((n) => (
              <Toggle key={n} active={selected.includes(n)} onClick={() => toggleFamily(n)}>×{n}</Toggle>
            ))}
          </div>
          <p className="mt-3 text-sm text-indigo-800/80">Tip: choose any mix like <span className="font-mono">×0–×3</span> or just <span className="font-mono">×7</span>.</p>
        </section>

        {/* Status & Controls */}
        <section className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Time" value={`${timeLeft}s`} />
          <Stat label="Score" value={score} />
          <Stat label="# Selected" value={selected.length} />
          <Stat label="Best today (set)" value={Math.max(best, score)} />
        </section>

        {/* Game area */}
        <section className="bg-white/90 backdrop-blur rounded-3xl shadow-xl border border-indigo-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-indigo-700">Set: <span className="font-mono bg-indigo-50 px-2 py-0.5 rounded-xl border border-indigo-100">{key || "(none)"}</span></div>
            <div className="flex gap-2">
              {!running ? (
                <button onClick={startRound} disabled={selected.length === 0} className="px-5 py-3 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white font-extrabold shadow-lg disabled:opacity-40">
                  {selected.length === 0 ? "Select facts" : `Start ${seconds}s round`}
                </button>
              ) : (
                <button onClick={endRound} className="px-5 py-3 rounded-2xl bg-rose-600 text-white font-extrabold shadow">End Round</button>
              )}
            </div>
          </div>

          <div className={"grid gap-5 sm:gap-6 " + (running ? "opacity-100" : "opacity-90") }>
            <div className="flex items-center justify-center">
              <div className="text-6xl sm:text-7xl font-black tabular-nums text-indigo-900 drop-shadow">{current.a} × {current.b} = ?</div>
            </div>

            <form onSubmit={handleSubmit} className="flex items-center justify-center gap-3">
              <input
                ref={answerRef}
                name="answer"
                type="number"
                inputMode="numeric"
                autoComplete="off"
                disabled={!running}
                placeholder="Type answer here"
                className={`w-44 text-center text-3xl font-extrabold px-5 py-4 rounded-2xl border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-40 transition placeholder:text-base placeholder:text-indigo-300 ${flashRing}`}
              />
              <button type="submit" disabled={!running} className="px-5 py-4 rounded-2xl bg-emerald-500 text-white font-extrabold shadow disabled:opacity-40">Enter</button>
            </form>

            <p className="text-center text-sm text-indigo-700">✅ Right answers glow green • ❌ Wrong answers shake & flash red</p>
          </div>
        </section>

        {/* End-of-round modal */}
        {lastResult && showEndModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="relative w-[min(92vw,700px)] max-h-[80vh] overflow-auto rounded-3xl border border-fuchsia-200 shadow-2xl bg-gradient-to-br from-pink-50 to-amber-50 p-6">
              <button aria-label="Close" onClick={() => setShowEndModal(false)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/80 border border-rose-200 text-rose-600 font-bold hover:bg-white">×</button>
              <h3 className="text-2xl font-black text-indigo-900 mb-2">Round results</h3>
              <p className="text-indigo-900 mb-3">Score this round: <span className="font-extrabold">{lastResult.score}</span> • Best today (this set): <span className="font-extrabold">{Math.max(lastResult.best, lastResult.score)}</span></p>
              {lastResult.stats && (
                <div className="space-y-2">
                  <div className="text-sm text-indigo-900/90">Correct: {lastResult.stats.correct} • Wrong attempts: {lastResult.stats.wrong}</div>
                  {lastResult.stats.missed.length > 0 ? (
                    <div className="text-base">
                      <div className="font-semibold text-rose-700">Missed facts:</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {lastResult.stats.missed.map(m => (
                          <span key={`${m.a}-${m.b}`} className="px-2 py-1 rounded-xl bg-white border border-rose-200 text-rose-700 text-lg font-extrabold">{m.a}×{m.b}={m.ans}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-emerald-700 font-semibold">No misses — perfect round! 🎉</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom summary panel (persists after closing modal) */}
        {lastResult && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow">
            <div className="font-extrabold text-emerald-900">Great job!</div>
            <div className="text-sm text-emerald-900">You scored <span className="font-bold">{lastResult.score}</span>. Best today for this set is <span className="font-bold">{Math.max(lastResult.best, lastResult.score)}</span>.</div>
            {lastResult.stats && (
              <div className="mt-3 grid gap-2">
                <div className="text-sm font-semibold text-indigo-900">Round accuracy</div>
                <div className="text-sm text-indigo-900/90">Correct: {lastResult.stats.correct} • Wrong attempts: {lastResult.stats.wrong}</div>
                {lastResult.stats.missed.length > 0 ? (
                  <div className="text-sm text-rose-700">
                    Missed facts to review (auto‑included next round):
                    {lastResult.stats.missed.map(m => (
                      <span key={`${m.a}-${m.b}`} className="mx-1 text-lg font-extrabold text-rose-700"> {m.a}×{m.b}={m.ans} </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-emerald-700">No misses — perfect round! 🎉</div>
                )}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button onClick={sameSetPlayAgain} className="px-4 py-2 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white font-bold shadow">Play again (same set)</button>
              <button onClick={() => setLastResult(null)} className="px-4 py-2 rounded-2xl bg-white border border-indigo-200 text-indigo-900">Dismiss</button>
            </div>
          </div>
        )}

        <footer className="mt-10 text-xs text-indigo-800/80"><p>Parents: choose any mix (including ×0 and ×1). Problems always use multipliers 1–12. Timer is adjustable.</p></footer>
      </div>

      {/* CSS helpers */}
      <style>{`
        @keyframes shake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(2px); } 30%, 50%, 70% { transform: translateX(-4px); } 40%, 60% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.2s linear; }
        @media (min-width: 768px) { .md\\:grid-cols-13 { grid-template-columns: repeat(13, minmax(0, 1fr)); } }
      `}</style>
    </div>
  );
}

// ---------------------- Stats & utils -------------------------------------
function buildStats(attempts: Attempt[]) {
  const correct = attempts.filter(a => a.correct).length;
  const wrong = attempts.filter(a => !a.correct).length;
  const missedMap = new Map<string, Problem>();
  for (const att of attempts) { if (!att.correct) { const k = `${att.a}x${att.b}`; if (!missedMap.has(k)) missedMap.set(k, { a: att.a, b: att.b, ans: att.ans }); } }
  return { correct, wrong, missed: Array.from(missedMap.values()) };
}

// ---------------------- Dev sanity tests ----------------------------------
function runDevTests() {
  try {
    console.group("Minute Multiplication — sanity tests");

    // selectionKey sorts & joins
    console.assert(selectionKey([3,1,2]) === "1,2,3", "selectionKey should sort ascending");
    console.assert(selectionKey([]) === "", "selectionKey empty set");

    // genRandomProblem respects families and 1..12 multipliers
    for (let i = 0; i < 10; i++) {
      const p = genRandomProblem([2,7]);
      console.assert([2,7].includes(p.a), "a must be from selected families");
      console.assert(p.b >= 1 && p.b <= 12, "b must be 1..12");
      console.assert(p.ans === p.a * p.b, "ans must equal a*b");
    }

    // buildStats counts and de-duplicates misses
    const stats = buildStats([
      { a: 2, b: 3, ans: 6, resp: 6, correct: true },
      { a: 2, b: 4, ans: 8, resp: 9, correct: false },
      { a: 2, b: 4, ans: 8, resp: 7, correct: false },
      { a: 7, b: 6, ans: 42, resp: 40, correct: false }
    ]);
    console.assert(stats.correct === 1, "correct count");
    console.assert(stats.wrong === 3, "wrong count");
    console.assert(stats.missed.length === 2, "unique missed facts");

    // bestKey contains date + set key
    const k = "2,7"; const bk = bestKey(k);
    console.assert(bk.includes(todayStr()) && bk.includes(k), "bestKey structure");

    // clampInt boundaries
    console.assert(clampInt("100", 10, 90) === 90, "clamp upper bound");
    console.assert(clampInt("-5", 0, 60) === 0, "clamp lower bound");

    // todayStr format
    console.assert(/^\d{4}-\d{2}-\d{2}$/.test(todayStr()), "todayStr format YYYY-MM-DD");

    console.groupEnd();
  } catch (err) {
    console.error("Sanity test failed:", err);
  }
}

if (typeof window !== 'undefined' && !(window as any).__MM_TESTS_DONE__) {
  (window as any).__MM_TESTS_DONE__ = true;
  runDevTests();
}
