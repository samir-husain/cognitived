// Turn lifecycle for a streaming AI answer: one active turn at a time, a generation
// id so late chunks from a cancelled turn are ignored, and a first-byte deadline so
// a silent service becomes a clear message instead of a frozen screen.
//
// Everything here is plain data and callbacks; the transport (SSE, WebSocket, fetch)
// is injected as `start(onChunk, onDone, onError)` returning a cancel function.

export function createTurnController({ start, firstByteMs = 15000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let generation = 0;
  let active = null;

  function finish(outcome) {
    if (!active) return;
    const turn = active;
    active = null;
    clearTimer(turn.deadline);
    turn.onEnd(outcome);
  }

  /** Begin a turn. Rejected if another turn is running: the caller must cancel first. */
  function ask(prompt, { onChunk, onEnd }) {
    if (active) throw new Error("a turn is already running; cancel it first");
    const myGen = ++generation;
    const turn = { gen: myGen, chunks: 0, onEnd, deadline: null, cancel: null };
    active = turn;

    turn.deadline = setTimer(() => {
      if (active === turn && turn.chunks === 0) {
        turn.cancel && turn.cancel();
        finish({ status: "timeout", chunks: 0 });
      }
    }, firstByteMs);

    turn.cancel = start(
      (chunk) => {
        if (myGen !== generation || active !== turn) return; // late chunk from a cancelled turn: ignore
        turn.chunks++;
        if (turn.chunks === 1) clearTimer(turn.deadline);
        onChunk(chunk);
      },
      () => {
        if (active === turn) finish({ status: "done", chunks: turn.chunks });
      },
      (error) => {
        if (active === turn) finish({ status: "error", chunks: turn.chunks, error });
      },
    );
    return myGen;
  }

  /** Stop the active turn atomically: transport, timers and any further rendering. */
  function cancel() {
    if (!active) return false;
    const turn = active;
    generation++; // invalidates chunks still in flight
    turn.cancel && turn.cancel();
    finish({ status: "cancelled", chunks: turn.chunks });
    return true;
  }

  return { ask, cancel, isActive: () => active !== null };
}
