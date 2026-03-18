import React, { useEffect, useMemo, useRef, useState } from "react";

export default function PopButton({
  canClick,
  phase,
  event,
  onClick,
  imgClosed,
  imgOpen,
  overlayTop = true,
  scoreText,
}) {
  const [pressed, setPressed] = useState(false);

  // ✅ FIX 1 — Keep canClick and onClick in refs so ALL handlers (pointer,
  //    keyboard, hold-loop) always read the current value without needing
  //    to re-register listeners or re-create timers on every render.
  //    This is the #1 source of "click registered but nothing happened" on mobile.
  const canClickRef = useRef(canClick);
  const onClickRef  = useRef(onClick);
  useEffect(() => { canClickRef.current = canClick; }, [canClick]);
  useEffect(() => { onClickRef.current  = onClick;  }, [onClick]);

  const activePtrsRef  = useRef(new Set());
  const holdTimerRef   = useRef(null);

  // Always reads fresh ref — safe to call from any closure without staleness
  const fireClick = () => {
    if (!canClickRef.current) return;
    onClickRef.current?.();
  };

  const stopHoldLoop = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const startHoldLoop = () => {
    stopHoldLoop();
    const loop = () => {
      // ✅ FIX 2 — Read the ref each iteration so the loop respects canClick
      //    changes that happened between ticks (e.g. game phase ended mid-hold).
      //    Old code: fireClick() closed over stale canClick from render time.
      if (activePtrsRef.current.size <= 0) return;
      fireClick();
      holdTimerRef.current = setTimeout(loop, 55);
    };
    holdTimerRef.current = setTimeout(loop, 55);
  };

  const onDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // ✅ FIX 3 — setPointerCapture ensures pointerup/pointercancel always fire
    //    on THIS element even if the finger slides off the edge.
    //    Without this, fast swipe-taps frequently miss the pointerup entirely,
    //    leaving the button stuck in "pressed" state and the hold-loop running
    //    indefinitely — the single biggest cause of phantom clicks on mobile.
    e.currentTarget.setPointerCapture(e.pointerId);

    activePtrsRef.current.add(e.pointerId);
    setPressed(true);
    fireClick();
    startHoldLoop();
  };

  const onUp = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    activePtrsRef.current.delete(e.pointerId);
    if (activePtrsRef.current.size <= 0) {
      setPressed(false);
      stopHoldLoop();
    }
  };

  // ✅ FIX 4 — Remove onPointerLeave entirely.
  //    On mobile, ANY sub-pixel finger movement fires pointerleave, which was
  //    calling onUp() and clearing the pointer from the active set mid-hold.
  //    With setPointerCapture (Fix 3) in place, pointerleave no longer fires
  //    for captured pointers — but remove the handler anyway to be safe.
  //    The only exits are now onPointerUp and onPointerCancel, which is correct.

  // ✅ FIX 5 — Spacebar useEffect with empty dep array + refs.
  //    Old code: dep array was [canClick], so the effect re-ran every time the
  //    game phase changed — removing and re-adding listeners mid-keydown,
  //    which could swallow a keydown or leave a ghost keyup handler.
  //    New code: register once, read canClickRef.current inside the handler.
  useEffect(() => {
    const onKeyDown = (ev) => {
      if (ev.code !== "Space") return;
      ev.preventDefault();
      if (activePtrsRef.current.has("SPACE")) return; // already held
      activePtrsRef.current.add("SPACE");
      setPressed(true);
      fireClick();        // reads canClickRef.current — never stale
      startHoldLoop();
    };
    const onKeyUp = (ev) => {
      if (ev.code !== "Space") return;
      ev.preventDefault();
      activePtrsRef.current.delete("SPACE");
      if (activePtrsRef.current.size <= 0) {
        setPressed(false);
        stopHoldLoop();
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup",   onKeyUp,   { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
    };
  }, []); // ✅ empty — stable forever, reads latest values via refs

  const activeImg = pressed ? (imgOpen || imgClosed) : (imgClosed || imgOpen);

  const hint =
    !canClick
      ? phase === "idle"   ? "Waiting for admin…"
      : phase === "lobby"  ? "Get ready…"
      : phase === "paused" ? "Paused"
      : "—"
      : event?.active
        ? event.type === "BOMB" ? "BOMB (-5)" : "BONUS (+2)"
        : "NORMAL (+1)";

  const bg = useMemo(() => {
    return `radial-gradient(1200px 600px at 30% 5%, rgba(34,211,238,.35) 0%, rgb(2,6,23) 60%),
            radial-gradient(900px 520px at 85% 10%, rgba(124,58,237,.38) 0%, transparent 60%),
            rgb(2,6,23)`;
  }, []);

  return (
    <div
      className="popcatStage"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      // ✅ onPointerLeave intentionally removed — see FIX 4
      style={{
        position: "relative",
        width: "100%",
        height: "min(62vh, 560px)",
        borderRadius: 28,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,.20)",
        background: bg,
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
        touchAction: "none",
        cursor: canClick ? "pointer" : "default",
        boxShadow: "0 50px 160px -120px rgba(0,0,0,.9)",
        opacity: 1,
        isolation: "isolate",
      }}
      title={canClick ? "Click / Tap / Hold / Space" : "Not clickable now"}
    >
      {/* Inner gradient overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background:
          "radial-gradient(1200px 600px at 50% 10%, rgba(255,255,255,.06), transparent 55%), " +
          "radial-gradient(800px 500px at 50% 100%, rgba(0,0,0,.40), transparent 55%)",
        pointerEvents: "none",
      }} />

      {overlayTop && (
        <div style={{
          position: "absolute", left: 18, right: 18, top: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, pointerEvents: "none",
        }}>
          <div style={{
            padding: "8px 12px", borderRadius: 999,
            border: "1px solid rgba(255,255,255,.20)",
            background: "rgb(8,15,40)", color: "rgba(226,232,240,.95)",
            fontWeight: 950, letterSpacing: 0.2,
            boxShadow: "0 4px 16px rgba(0,0,0,.5)",
          }}>
            {hint}
          </div>
          {scoreText ? (
            <div style={{
              padding: "8px 12px", borderRadius: 999,
              border: "1px solid rgba(255,255,255,.20)",
              background: "rgb(8,15,40)", color: "rgba(255,255,255,.98)",
              fontWeight: 950, boxShadow: "0 4px 16px rgba(0,0,0,.5)",
            }}>
              {scoreText}
            </div>
          ) : null}
        </div>
      )}

      <div style={{
        position: "absolute", inset: 0,
        display: "grid", placeItems: "center", padding: 24,
      }}>
        <div style={{
          width: "min(560px, 92%)",
          aspectRatio: "1 / 1",
          borderRadius: 32,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,.15)",
          background: "rgb(10,18,50)",
          transform: pressed ? "scale(1.02)" : "scale(1)",
          transition: "transform 90ms ease-out, filter 90ms ease-out",
          filter: pressed
            ? "drop-shadow(0 18px 70px rgba(124,58,237,.40)) drop-shadow(0 18px 70px rgba(34,211,238,.28))"
            : "drop-shadow(0 18px 70px rgba(0,0,0,.60))",
        }}>
          {activeImg ? (
            <img
              src={activeImg}
              alt="pop"
              draggable={false}
              style={{
                width: "100%", height: "100%",
                objectFit: "cover", display: "block",
                transform: pressed ? "scale(1.03)" : "scale(1)",
                transition: "transform 90ms ease-out",
                pointerEvents: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
              }}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              display: "grid", placeItems: "center",
              fontWeight: 950, color: "rgba(226,232,240,.75)",
            }}>
              Upload manager pop images
            </div>
          )}
        </div>
      </div>

      <div style={{
        position: "absolute", left: 18, right: 18, bottom: 14,
        display: "flex", justifyContent: "space-between",
        gap: 10, pointerEvents: "none",
        color: "rgba(226,232,240,.65)", fontSize: 12, fontWeight: 800,
      }}>
        <div>Tip: Multi-finger supported · Spacebar works</div>
        <div>Spectator: /screen</div>
      </div>
    </div>
  );
}
