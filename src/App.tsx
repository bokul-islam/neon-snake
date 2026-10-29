import { useCallback, useEffect, useRef, useState } from "react";
import { Engine, type Dir } from "./game/engine";
import { Renderer } from "./game/render";
import { sfx } from "./game/audio";
import { addScore, getScores, qualifies, type ScoreEntry } from "./game/scores";

type Screen = "menu" | "playing" | "paused" | "gameover";

const DIR_KEYS: Record<string, Dir> = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

/* ---------- tiny inline icons ---------- */

const IconPause = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
    <rect x="3" y="2" width="4" height="12" />
    <rect x="9" y="2" width="4" height="12" />
  </svg>
);

const IconPlay = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
    <path d="M4 2l10 6-10 6z" />
  </svg>
);

const IconSound = ({ off }: { off: boolean }) => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
    <path d="M2 6h3l4-3v10L5 10H2z" />
    {off ? (
      <path d="M11 5.5l4 5m0-5l-4 5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    ) : (
      <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5M13 3.5a6 6 0 0 1 0 9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    )}
  </svg>
);

const IconTrophy = () => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
    <path d="M5 2h6v1h3v2c0 1.8-1.3 3.2-3 3.7-.4 1-1.2 1.7-2 1.9V12h2v2H5v-2h2v-1.4c-.8-.2-1.6-.9-2-1.9C3.3 8.2 2 6.8 2 5V3h3V2zM3 5v.5c.02.7.32 1.34.8 1.8V5H3zm10 0h-.8v.3c.48-.46.78-1.1.8-1.8V5h.01z" />
  </svg>
);

const Chevron = ({ rot }: { rot: string }) => (
  <svg
    viewBox="0 0 16 16"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    style={{ transform: rot }}
  >
    <path d="M3 10.5l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SnakeLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 32" className={className} fill="none">
    <path
      d="M6 23 C 12 23, 12 8, 20 8 C 28 8, 28 23, 36 23 C 44 23, 44 10, 52 10"
      stroke="#46ff8a"
      strokeWidth="7"
      strokeLinecap="round"
    />
    <path
      d="M6 23 C 12 23, 12 8, 20 8 C 28 8, 28 23, 36 23 C 44 23, 44 10, 52 10"
      stroke="#e2ff5c"
      strokeWidth="2.4"
      strokeLinecap="round"
      opacity="0.7"
    />
    <circle cx="53" cy="10" r="6.5" fill="#eaff6b" />
    <circle cx="55.4" cy="8.2" r="2" fill="#06231a" />
    <path d="M59.5 12.5l4 1.6-4 1.4" stroke="#ff4d6d" strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </svg>
);

/* ---------- score table ---------- */

function ScoreTable({
  scores,
  compact,
  highlight,
}: {
  scores: ScoreEntry[];
  compact?: boolean;
  highlight?: boolean;
}) {
  if (!scores.length)
    return (
      <p className="text-[11px] font-semibold tracking-[0.22em] text-[#5fae86]">
        NO SCORES YET — SET THE FIRST
      </p>
    );
  return (
    <div className="w-full">
      {scores.slice(0, compact ? 3 : 5).map((s, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 border-b border-[#46ff8a14] py-[4px] text-[12px] tracking-[0.12em] ${
            i === 0 && highlight ? "glow-gold text-[#ffcf3f]" : i === 0 ? "text-[#a9ffd2]" : "text-[#6fcf9d]"
          }`}
        >
          <span className="font-arcade w-7 text-[9px]">{i + 1}.</span>
          <span className="flex-1 truncate font-bold">{s.name}</span>
          {compact ? (
            <span className="font-arcade text-[10px]">{s.score}</span>
          ) : (
            <>
              <span className="w-10 text-[10px] text-[#4d8a6b]">{s.date}</span>
              <span className="font-arcade w-14 text-right text-[10px]">{s.score}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- d-pad ---------- */

function DPad({ onDir }: { onDir: (d: Dir) => void }) {
  const mk = (label: string, d: Dir, rot: string, area: string) => (
    <button
      type="button"
      aria-label={label}
      className="dpad-btn"
      style={{ gridArea: area }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        sfx.ensure();
        onDir(d);
      }}
    >
      <Chevron rot={rot} />
    </button>
  );
  return (
    <div className="dpad pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
      {mk("Up", { x: 0, y: -1 }, "", "1 / 2 / 2 / 3")}
      {mk("Left", { x: -1, y: 0 }, "rotate(-90deg)", "2 / 1 / 3 / 2")}
      {mk("Down", { x: 0, y: 1 }, "rotate(180deg)", "2 / 2 / 3 / 3")}
      {mk("Right", { x: 1, y: 0 }, "rotate(90deg)", "2 / 3 / 3 / 4")}
    </div>
  );
}

/* ================================================================ */

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [score, setScore] = useState(0);
  const [len, setLen] = useState(3);
  const [best, setBest] = useState<number>(() => getScores()[0]?.score ?? 0);
  const [scores, setScores] = useState<ScoreEntry[]>(() => getScores());
  const [muted, setMuted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [canSave, setCanSave] = useState(false);
  const [finalStats, setFinalStats] = useState({ score: 0, len: 3, streak: 0 });
  const [isNewBest, setIsNewBest] = useState(false);
  const [coarse] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const screenRef = useRef<Screen>("menu");
  screenRef.current = screen;
  const bestRef = useRef(best);
  bestRef.current = best;
  const canSaveRef = useRef(canSave);
  canSaveRef.current = canSave;
  const savedRef = useRef(saved);
  savedRef.current = saved;

  /* ---------- engine (once) ---------- */
  const engineRef = useRef<Engine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new Engine({
      onScore: (s, l) => {
        setScore(s);
        setLen(l);
      },
      onEat: (st) => sfx.eat(st),
      onBonus: () => sfx.bonus(),
      onDie: (s, l, st) => {
        sfx.die();
        window.setTimeout(() => {
          setFinalStats({ score: s, len: l, streak: st });
          setIsNewBest(s > bestRef.current && s > 0);
          setCanSave(qualifies(s));
          setSaved(false);
          setScreen("gameover");
        }, 950);
      },
    });
  }

  useEffect(() => {
    engineRef.current!.ai = screen === "menu";
  }, [screen]);

  /* ---------- renderer + sizing ---------- */
  useEffect(() => {
    const canvas = canvasRef.current!;
    const box = boxRef.current!;
    const renderer = new Renderer(canvas);
    rendererRef.current = renderer;
    const fit = () => {
      const r = box.getBoundingClientRect();
      const s = Math.max(120, Math.floor(Math.min(r.width, r.height) - 20));
      renderer.resize(s, Math.min(window.devicePixelRatio || 1, 2));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  /* ---------- main loop ---------- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      if (screenRef.current !== "paused") engineRef.current!.update(dt);
      rendererRef.current?.draw(engineRef.current!);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (document.fonts?.load) void document.fonts.load("12px 'Press Start 2P'");
  }, []);

  /* ---------- actions ---------- */
  const startGame = useCallback(() => {
    sfx.ensure();
    sfx.start();
    const e = engineRef.current!;
    e.ai = false;
    e.reset();
    setScore(0);
    setLen(3);
    setScreen("playing");
  }, []);

  const togglePause = useCallback(() => {
    const sc = screenRef.current;
    if (sc === "playing" && engineRef.current!.dying) return;
    if (sc === "playing") {
      setScreen("paused");
      sfx.pause(true);
    } else if (sc === "paused") {
      setScreen("playing");
      sfx.pause(false);
    }
  }, []);

  const gotoMenu = useCallback(() => {
    const e = engineRef.current!;
    e.ai = true;
    e.reset();
    setScreen("menu");
    sfx.ui();
  }, []);

  const toggleMute = useCallback(() => {
    sfx.muted = !sfx.muted;
    setMuted(sfx.muted);
    sfx.ui();
  }, []);

  const steer = useCallback((d: Dir) => {
    if (engineRef.current!.enqueue(d)) sfx.turn();
  }, []);

  // blur after click so Space/Enter never re-fire a focused button
  const click =
    (fn: () => void) =>
    (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.blur();
      fn();
    };

  const saveScore = useCallback(() => {
    if (savedRef.current || !canSaveRef.current) return;
    const name = nameRef.current?.value ?? "";
    const list = addScore(name, finalStats.score, finalStats.len);
    setScores(list);
    setBest(list[0]?.score ?? 0);
    setSaved(true);
    if (nameRef.current) nameRef.current.blur();
    sfx.save();
  }, [finalStats.score, finalStats.len]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement) return;
      sfx.ensure();
      const sc = screenRef.current;
      const d = DIR_KEYS[ev.code];
      if (d) {
        ev.preventDefault();
        if (sc === "menu") {
          startGame();
          steer(d);
        } else if (sc === "playing") {
          steer(d);
        }
        return;
      }
      switch (ev.code) {
        case "Enter":
        case "Space":
          ev.preventDefault();
          if (sc === "menu") startGame();
          else if (sc === "paused") togglePause();
          else if (sc === "gameover") {
            if (canSaveRef.current && !savedRef.current) nameRef.current?.focus();
            else startGame();
          }
          break;
        case "KeyP":
        case "Escape":
          if (sc === "playing" || sc === "paused") togglePause();
          break;
        case "KeyM":
          toggleMute();
          break;
        case "KeyR":
          if (sc === "gameover" || sc === "paused") startGame();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startGame, steer, togglePause, toggleMute]);

  /* ---------- auto pause when tab hidden ---------- */
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && screenRef.current === "playing") setScreen("paused");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /* ---------- focus name input on game over ---------- */
  useEffect(() => {
    if (screen === "gameover" && canSave && !saved && !coarse) {
      const t = window.setTimeout(() => nameRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [screen, canSave, saved, coarse]);

  /* ---------- swipe on canvas ---------- */
  const touchRef = useRef<{ x: number; y: number; swiped: boolean; id: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    sfx.ensure();
    touchRef.current = { x: e.clientX, y: e.clientY, swiped: false, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const t = touchRef.current;
    if (!t || t.id !== e.pointerId || t.swiped) return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    t.swiped = true;
    steer(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
  };
  const onPointerEnd = () => {
    touchRef.current = null;
  };

  const playing = screen === "playing";
  const hi = Math.max(best, score);

  return (
    <div className="app-bg h-dvh w-full overflow-hidden p-2 sm:p-4" onContextMenu={(e) => e.preventDefault()}>
      <div className="cab relative mx-auto flex h-full max-h-[940px] w-full max-w-[540px] flex-col gap-2 px-3 py-2.5">
        {/* header */}
        <header className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <SnakeLogo className="h-5 w-10" />
            <span className="font-arcade text-[10px] tracking-[0.14em] text-[#8affc0]">
              NEON<span className="text-[#d9ff4f]"> SNAKE</span>
            </span>
          </div>
          <span className="font-arcade blink text-[10px] text-[#ff4d6d]">1UP</span>
        </header>

        {/* HUD */}
        <div className="flex items-stretch gap-1.5">
          <div className="flex flex-1 flex-col items-center justify-center border border-[#46ff8a2e] bg-[#081c11] px-2 py-1">
            <span className="text-[9px] font-semibold tracking-[0.24em] text-[#5fae86]">LENGTH</span>
            <span key={len} className="font-arcade score-pop text-[13px] text-[#c9ffe0]">{len}</span>
          </div>
          <div className="flex flex-[1.5] flex-col items-center justify-center border border-[#46ff8a45] bg-[#0a2315] px-2 py-1">
            <span className="text-[9px] font-semibold tracking-[0.24em] text-[#5fae86]">SCORE</span>
            <span key={score} className="font-arcade score-pop text-[19px] leading-5 text-[#eafff2] glow-green">
              {score}
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center border border-[#46ff8a2e] bg-[#081c11] px-2 py-1">
            <span className="text-[9px] font-semibold tracking-[0.24em] text-[#5fae86]">HI-SCORE</span>
            <span className="font-arcade text-[13px] text-[#ffcf3f]">{hi}</span>
          </div>
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            className="btn-icon w-10 touch-manipulation"
            onClick={click(() => {
              if (playing || screen === "paused") togglePause();
            })}
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button
            type="button"
            aria-label="Toggle sound"
            className={`btn-icon w-10 touch-manipulation ${muted ? "is-off" : ""}`}
            onClick={click(toggleMute)}
          >
            <IconSound off={muted} />
          </button>
        </div>

        {/* stage */}
        <div ref={boxRef} className="relative flex min-h-0 flex-1 items-center justify-center">
          <div className="stage-frame scanlines relative p-1.5">
            <canvas
              ref={canvasRef}
              className="block select-none touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
            />

            {/* d-pad */}
            {coarse && playing && (
              <div className="pointer-events-none absolute bottom-3 left-3 z-20 opacity-70">
                <DPad onDir={steer} />
              </div>
            )}

            {/* ============ MENU ============ */}
            {screen === "menu" && (
              <div
                className="absolute inset-0 z-30 flex items-center justify-center bg-[#030b07b8] p-3"
                onClick={startGame}
              >
                <div className="panel panel-in w-[min(100%,400px)] px-5 py-6 text-center">
                  <SnakeLogo className="float-y mx-auto mb-3 h-9 w-[86px]" />
                  <h1 className="font-arcade text-[24px] leading-8 sm:text-[28px]">
                    <span className="glow-cyan text-[#35e6ff]">NEON</span>{" "}
                    <span className="title-pulse text-[#46ff8a]">SNAKE</span>
                  </h1>
                  <p className="mt-2 text-[11px] font-semibold tracking-[0.4em] text-[#6fcf9d]">
                    EAT · GROW · SURVIVE
                  </p>

                  <p className="font-arcade mt-5 blink text-[10px] leading-5 text-[#eafff2]">
                    {coarse ? "TAP TO PLAY" : "PRESS ENTER TO PLAY"}
                  </p>

                  <div className="mt-5 space-y-1.5 border-t border-[#46ff8a26] pt-4 text-[11px] font-semibold tracking-[0.14em] text-[#7fd6a8]">
                    {coarse ? (
                      <p>SWIPE OR USE THE D-PAD TO STEER</p>
                    ) : (
                      <>
                        <p>
                          <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / ARROWS — STEER
                        </p>
                        <p>
                          <kbd>P</kbd> PAUSE&nbsp;&nbsp;·&nbsp;&nbsp;<kbd>M</kbd> SOUND
                        </p>
                      </>
                    )}
                  </div>

                  <div className="mt-4 border-t border-[#46ff8a26] pt-3 text-left">
                    <div className="mb-1 flex items-center gap-1.5 text-[#ffcf3f]">
                      <IconTrophy />
                      <span className="text-[10px] font-bold tracking-[0.3em]">HIGH SCORES</span>
                    </div>
                    <ScoreTable scores={scores} compact />
                  </div>
                </div>
              </div>
            )}

            {/* ============ PAUSE ============ */}
            {screen === "paused" && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#030b07cc] p-3">
                <div className="panel panel-in w-[min(100%,320px)] px-6 py-6 text-center">
                  <h2 className="font-arcade text-[18px] text-[#35e6ff] glow-cyan">PAUSED</h2>
                  <p className="mt-2 text-[11px] font-semibold tracking-[0.2em] text-[#6fcf9d]">
                    THE SNAKE WAITS FOR YOU
                  </p>
                  <div className="mt-5 flex flex-col gap-2.5">
                    <button type="button" className="btn px-4 py-2.5 text-[13px] touch-manipulation" onClick={click(togglePause)}>
                      Resume
                    </button>
                    <button type="button" className="btn btn-ghost px-4 py-2.5 text-[13px] touch-manipulation" onClick={click(startGame)}>
                      Restart
                    </button>
                    <button type="button" className="btn btn-ghost px-4 py-2.5 text-[13px] touch-manipulation" onClick={click(gotoMenu)}>
                      Quit to Menu
                    </button>
                  </div>
                  {!coarse && (
                    <p className="mt-4 text-[10px] font-semibold tracking-[0.2em] text-[#4d8a6b]">
                      <kbd>P</kbd> / <kbd>ESC</kbd> — RESUME
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ============ GAME OVER ============ */}
            {screen === "gameover" && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0c0508c9] p-3">
                <div className="panel panel-red panel-in w-[min(100%,380px)] px-5 py-5 text-center">
                  <h2 className="font-arcade text-[20px] text-[#ff4d6d] glow-red">GAME OVER</h2>

                  {isNewBest && (
                    <p className="font-arcade mt-2 blink text-[10px] text-[#ffcf3f] glow-gold">
                      ★ NEW RECORD ★
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-center gap-3">
                    <div className="flex-1 border border-[#46ff8a33] bg-[#0a2315] px-2 py-2">
                      <p className="text-[9px] font-semibold tracking-[0.22em] text-[#5fae86]">SCORE</p>
                      <p className="font-arcade text-[18px] text-[#eafff2]">{finalStats.score}</p>
                    </div>
                    <div className="flex-1 border border-[#46ff8a33] bg-[#081c11] px-2 py-2">
                      <p className="text-[9px] font-semibold tracking-[0.22em] text-[#5fae86]">LENGTH</p>
                      <p className="font-arcade text-[14px] text-[#c9ffe0]">{finalStats.len}</p>
                    </div>
                    <div className="flex-1 border border-[#46ff8a33] bg-[#081c11] px-2 py-2">
                      <p className="text-[9px] font-semibold tracking-[0.22em] text-[#5fae86]">STREAK</p>
                      <p className="font-arcade text-[14px] text-[#35e6ff]">x{finalStats.streak}</p>
                    </div>
                  </div>

                  {canSave && !saved && (
                    <div className="mt-4">
                      <p className="text-[10px] font-bold tracking-[0.3em] text-[#ffcf3f]">
                        TOP 5 — ENTER YOUR NAME
                      </p>
                      <div className="mt-2 flex gap-2">
                        <input
                          ref={nameRef}
                          className="name-input w-full px-2 py-2.5"
                          maxLength={8}
                          defaultValue=""
                          placeholder="YOUR"
                          autoCapitalize="characters"
                          spellCheck={false}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") saveScore();
                          }}
                        />
                        <button type="button" className="btn px-3 py-2 text-[11px] touch-manipulation" onClick={click(saveScore)}>
                          Save
                        </button>
                      </div>
                    </div>
                  )}

                  {saved && (
                    <p className="mt-3 text-[10px] font-bold tracking-[0.3em] text-[#46ff8a]">
                      SCORE SAVED
                    </p>
                  )}

                  <div className="mt-4 flex gap-2.5">
                    <button
                      type="button"
                      className="btn flex-1 px-4 py-2.5 text-[13px] touch-manipulation"
                      onClick={click(startGame)}
                    >
                      Play Again
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost flex-1 px-4 py-2.5 text-[13px] touch-manipulation"
                      onClick={click(gotoMenu)}
                    >
                      Menu
                    </button>
                  </div>

                  <div className="mt-4 border-t border-[#46ff8a26] pt-3 text-left">
                    <div className="mb-1 flex items-center gap-1.5 text-[#ffcf3f]">
                      <IconTrophy />
                      <span className="text-[10px] font-bold tracking-[0.3em]">HIGH SCORES</span>
                    </div>
                    <ScoreTable scores={scores} highlight={isNewBest} />
                  </div>

                  {!coarse && (
                    <p className="mt-3 text-[10px] font-semibold tracking-[0.2em] text-[#4d8a6b]">
                      <kbd>ENTER</kbd> — INSTANT RESTART
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* footer hints */}
        <footer className="flex items-center justify-center px-1 text-[10px] font-semibold tracking-[0.18em] text-[#4d8a6b]">
          {coarse ? (
            <p>SWIPE OR USE D-PAD TO STEER · GOLD ORB = BONUS</p>
          ) : (
            <p className="flex items-center gap-2">
              <span>
                <kbd>WASD</kbd> / <kbd>ARROWS</kbd> STEER
              </span>
              <span className="text-[#2e5c46]">|</span>
              <span>
                <kbd>P</kbd> PAUSE
              </span>
              <span className="text-[#2e5c46]">|</span>
              <span>
                <kbd>M</kbd> SOUND
              </span>
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
