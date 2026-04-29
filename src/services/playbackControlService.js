let stopPlaybackHandler = null;

export function registerStopPlaybackHandler(handler) {
  stopPlaybackHandler = handler;

  return () => {
    if (stopPlaybackHandler === handler) {
      stopPlaybackHandler = null;
    }
  };
}

export async function stopActivePlayback() {
  if (!stopPlaybackHandler) {
    return;
  }

  await stopPlaybackHandler();
}
