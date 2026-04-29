let stopPlaybackHandler = null;

let playbackState = {
  activeRecording: null,
  isPlaying: false,
};

const playbackStateListeners = new Set();

function notifyPlaybackStateListeners() {
  const snapshot = getPlaybackState();

  playbackStateListeners.forEach((listener) => {
    listener(snapshot);
  });
}

export function getPlaybackState() {
  return playbackState;
}

export function subscribeToPlaybackState(listener) {
  playbackStateListeners.add(listener);
  listener(getPlaybackState());

  return () => {
    playbackStateListeners.delete(listener);
  };
}

export function setActivePlaybackRecording(recording) {
  playbackState = {
    ...playbackState,
    activeRecording: recording || null,
  };

  notifyPlaybackStateListeners();
}

export function setActivePlaybackIsPlaying(isPlaying) {
  playbackState = {
    ...playbackState,
    isPlaying: Boolean(isPlaying),
  };

  notifyPlaybackStateListeners();
}

export function clearActivePlayback() {
  playbackState = {
    activeRecording: null,
    isPlaying: false,
  };

  notifyPlaybackStateListeners();
}

export function registerStopPlaybackHandler(handler) {
  stopPlaybackHandler = handler;

  return () => {
    if (stopPlaybackHandler === handler) {
      stopPlaybackHandler = null;
    }
  };
}

export async function stopActivePlayback() {
  if (stopPlaybackHandler) {
    await stopPlaybackHandler();
  }

  clearActivePlayback();
}
