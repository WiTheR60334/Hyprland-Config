function createMessageOverlay(video) {
  const messageOverlay = document.createElement("div");
  messageOverlay.id = "messageOverlay";

  const $video = $(video);
  messageOverlay.style.width = `${$video.width()}px`;

  messageOverlay.style.position = "absolute";
  messageOverlay.style.visibility = "hidden";

  setTimeout(() => {
    messageOverlay.style.removeProperty("visibility");
  }, 50);
  return messageOverlay;
}

function insertMessageOverlayIntoDOM(video, messageOverlay) {
  let shadowHost = document.createElement("DIV");
  shadowHost.className = "selectextMessageShadowHost";
  shadowHost.attachShadow({ mode: "open" });
  let shadowRoot = shadowHost.shadowRoot;

  shadowRoot.appendChild(messageOverlay);

  addStyleSheet(shadowRoot, "shadow.css");

  video.parentNode.insertBefore(shadowHost, video.nextSibling);

  $(messageOverlay).position({
    my: "left top",
    at: "left top",
    of: $(video),
  });

  return shadowHost;
}

function getMessageShadowHostForVideo(video) {
  return $(video).siblings(".selectextMessageShadowHost");
}

async function showScreenshotCopiedMessageInNewShadowHost(video) {
  const existingMessageOverlay = getMessageShadowHostForVideo(video);
  if (existingMessageOverlay.length > 0) {
    existingMessageOverlay.remove();
  }

  const newMessageOverlay = createMessageOverlay(video);
  const shadowHost = insertMessageOverlayIntoDOM(video, newMessageOverlay);

  const videoOverlay = getVideoOverlayForVideo(video);
  queryShadowRoot(".alertMessage", true, videoOverlay).css(
    "visibility",
    "hidden"
  );

  await showFadingMessage(
    " Screenshot copied",
    2000,
    false,
    "images/image.svg",
    newMessageOverlay,
    video
  );
  shadowHost.remove();
}

function showScreenshotCopiedMessage(video) {
  const videoOverlay = getVideoOverlayForVideo(video);
  if (videoOverlay !== undefined) {
    showFadingMessage(
      " Screenshot copied",
      2000,
      false,
      "images/image.svg",
      videoOverlay,
      video
    );
  } else {
    showScreenshotCopiedMessageInNewShadowHost(video);
  }
}


function copyPngBlobToClipboardChrome(blob) {
  navigator.clipboard.write([
    new ClipboardItem({
      "image/png": blob,
    }),
  ]);
}


function sendImageToParentAndCopy(dataUri) {
  return new Promise((resolve, reject) => {
    const onCopyDataUriToClipboardResponse = (e) => {
      if (e.data === undefined) {
        return;
      }

      if (e.data.type === "COPY_DATA_URI_TO_CLIPBOARD_SUCCESS") {
        resolve();
      } else if (e.data.type === "COPY_DATA_URI_TO_CLIPBOARD_FAILED") {
        reject();
      }
    }

    window.addEventListener("message", onCopyDataUriToClipboardResponse);

    window.top.postMessage({
      type: "COPY_DATA_URI_TO_CLIPBOARD",
      dataUri: dataUri,
      iframeSrc: window.location.href,
    }, "*")

    setTimeout(() => {
      window.removeEventListener("message", onCopyDataUriToClipboardResponse);
      reject()
    }, 500)
  })
}


async function copyVideoFrameScreenshot(
  video,
  viewportDimensions = null,
  offsetX = 0,
  offsetY = 0,
) {
  const videoPosition = getScreenPositionOfVideo(video);
  
  videoPosition.left += offsetX;
  videoPosition.top += offsetY;

  if (viewportDimensions === null) {
    viewportDimensions = getViewportDimensions();
  }

  if (!inIframe()) {
    const res = await captureVideoFrame(video, videoPosition, viewportDimensions, "blob");
    if (res === null) {
      return;
    }

    copyPngBlobToClipboardChrome(res.blob);
  } else {
    const res = await captureVideoFrame(video, videoPosition, viewportDimensions, "dataUriPng");
    if (res === null) {
      return;
    }

    await sendImageToParentAndCopy(res.dataUri);
  }

  showScreenshotCopiedMessage(video);
}

async function screenshotKeyboardShortcutPressed() {
  const videoOrIframe = await findBiggestScreenAreaVideoOrIframe();
  if (videoOrIframe === null) {
    return null;
  }

  if (videoOrIframe.video !== undefined) {
    copyVideoFrameScreenshot(videoOrIframe.video);
  } else {
    const iframe = videoOrIframe.iframe;
    const largestVideoIframeBoundingRect = iframe.getBoundingClientRect();
    iframe.contentWindow.postMessage(
      {
        type: "SCREENSHOT_KEYBOARD_SHORTCUT_PRESSED",
        viewportDimensions: getViewportDimensions(),
        offsetX: largestVideoIframeBoundingRect.left,
        offsetY: largestVideoIframeBoundingRect.top,
      },
      "*"
    );
  }
}

if (!inIframe()) {
  browser.runtime.onMessage.addListener(async (request) => {
    if (
      request.type !== undefined &&
      request.type === "COPY_VIDEO_SCREENSHOT_SHORTCUT"
    ) {
      if (await settingsManager.isSelectextEnabled() && await settingsManager.get("copyScreenshotKeyboardShortcutChecked")) {
        screenshotKeyboardShortcutPressed();
      }
    }
  });
} else {
  function screenshotKeyboardShortcutPressedHandler(
    windowWidth,
    windowHeight,
    offsetX,
    offsetY
  ) {
    const biggestVideo = findBiggestScreenAreaVideoOnPage(
      windowWidth,
      windowHeight,
      offsetX,
      offsetY
    );
    if (biggestVideo === null) {
      return;
    }
    copyVideoFrameScreenshot(biggestVideo.video, {width: windowWidth, height: windowHeight}, offsetX, offsetY);
  }

  window.addEventListener("message", function (event) {
    const eventData = event.data;
    if (eventData === undefined) {
      return;
    }

    const eventType = eventData.type;

    switch (eventType) {
      case "SCREENSHOT_KEYBOARD_SHORTCUT_PRESSED":
        screenshotKeyboardShortcutPressedHandler(
          eventData.viewportDimensions.width,
          eventData.viewportDimensions.height,
          eventData.offsetX,
          eventData.offsetY
        );
    }
  });
}
