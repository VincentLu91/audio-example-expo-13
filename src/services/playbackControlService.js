let playbackHandlers = {
  stop: null,
  togglePlayPause: null,
  seekTo: null,
};

let playbackState = {
  activeRecording: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
};

let playbackProgressTimer = null;

function stopPlaybackProgressTimer() {
  if (playbackProgressTimer) {
    clearInterval(playbackProgressTimer);
    playbackProgressTimer = null;
  }
}

function startPlaybackProgressTimer() {
  if (playbackProgressTimer) {
    return;
  }

  playbackProgressTimer = setInterval(() => {
    if (!playbackState.isPlaying || !playbackState.duration) {
      return;
    }

    const nextCurrentTime = Math.min(
      playbackState.currentTime + 1,
      playbackState.duration,
    );

    playbackState = {
      ...playbackState,
      currentTime: nextCurrentTime,
      isPlaying: nextCurrentTime < playbackState.duration,
    };

    notifyPlaybackStateListeners();

    if (nextCurrentTime >= playbackState.duration) {
      stopPlaybackProgressTimer();
    }
  }, 1000);
}

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

export function setActivePlaybackStatus(status) {
  playbackState = {
    ...playbackState,
    isPlaying: Boolean(status?.isPlaying),
    currentTime: status?.currentTime || 0,
    duration: status?.duration || 0,
  };

  if (playbackState.isPlaying) {
    startPlaybackProgressTimer();
  } else {
    stopPlaybackProgressTimer();
  }

  notifyPlaybackStateListeners();
}

export function setActivePlaybackIsPlaying(isPlaying) {
  playbackState = {
    ...playbackState,
    isPlaying: Boolean(isPlaying),
  };

  if (playbackState.isPlaying) {
    startPlaybackProgressTimer();
  } else {
    stopPlaybackProgressTimer();
  }

  notifyPlaybackStateListeners();
}

export function clearActivePlayback() {
  stopPlaybackProgressTimer();

  playbackState = {
    activeRecording: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  };

  notifyPlaybackStateListeners();
}

export function registerPlaybackHandlers(handlers) {
  playbackHandlers = {
    stop: handlers?.stop || null,
    togglePlayPause: handlers?.togglePlayPause || null,
    seekTo: handlers?.seekTo || null,
  };

  return () => {
    playbackHandlers = {
      stop: null,
      togglePlayPause: null,
      seekTo: null,
    };
  };
}

export function registerStopPlaybackHandler(handler) {
  playbackHandlers = {
    ...playbackHandlers,
    stop: handler,
  };

  return () => {
    if (playbackHandlers.stop === handler) {
      playbackHandlers = {
        ...playbackHandlers,
        stop: null,
      };
    }
  };
}

export async function stopActivePlayback() {
  if (playbackHandlers.stop) {
    await playbackHandlers.stop();
  }

  clearActivePlayback();
}

export async function toggleActivePlayback() {
  if (playbackHandlers.togglePlayPause) {
    await playbackHandlers.togglePlayPause();
  }
}

export async function seekActivePlayback(value) {
  if (playbackHandlers.seekTo) {
    await playbackHandlers.seekTo(value);
  }

  playbackState = {
    ...playbackState,
    currentTime: value || 0,
  };

  notifyPlaybackStateListeners();
}
