// Receives the key value as input from sendMessage - V

chrome.runtime.onMessage.addListener((playbackRate) => {
  document.querySelectorAll("video").forEach((item) => {
    item.playbackRate = playbackRate;
  });

  for (let i = 0; i < window.frames.length; i++) {
    document.querySelectorAll("iframe")[i].contentWindow.document.querySelectorAll("video").forEach((item) => {
        item.playbackRate = playbackRate;
      });
  }         
});

let affiliate = {
  URL: window.location.href,
};

chrome.storage.sync.set({ affiliate: affiliate }, function () {
  chrome.runtime.sendMessage({ ready: "ready" });
});