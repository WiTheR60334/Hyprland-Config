// Resize observer used for redrawing the text when the video size changes.
var resizeObserverMap = new Map();

var videoToVideoOverlayMap = new Map();

// Basic information about the last selection made
var currentSelectionInfo;

var settingsManager;

// Load Open Sans using JS for Chrome/Firefox compatibility
loadCustomFonts();

var mouseDown = false;

if (document.body) {
  document.body.onmousedown = function () {
    mouseDown = true;
  };
  document.body.onmouseup = function () {
    mouseDown = false;
  };
}

/**
 * Load the active colour from storage and set it, and search for the video on the page.
 */
$(document).ready(async () => {
  settingsManager = initSettings(await getTopLevelDomain(), {
    showReviewPrompt: false,
  });
  setupSettingsListeners(settingsManager);
  if (await shouldShowOverlay(settingsManager)) {
    findVideo(isInitialInjection());
  }
});

function isInitialInjection() {
  try {
    return INITIAL_INJECT;
  } catch (e) {
    if (e instanceof ReferenceError) {
      return false;
    }
  }
}

/**
 * Attach Selectext to all videos initially found on the page
 */
function findVideo(instantlyShowToggle = false) {
  let videos = document.getElementsByTagName("video");
  for (let i = 0; i < videos.length; i++) {
    let video = videos[i];

    if (
      instantlyShowToggle &&
      video.paused &&
      getVideoOverlayForVideo(video) === undefined
    ) {
      onVideoPause(video);
    }

    addVideoEventListeners(video);
  }

  findVideoAsync();
}

function onBothOnPauseTogglesTurnedOff() {
  Arrive.unbindAllArrive();

  $("video").each(function () {
    this.removeEventListener("pause", onVideoPauseWrapper);
  });
}

async function setupSettingsListeners(settingsManager) {
  settingsManager.addPauseChangeListener(async (isEnabled) => {
    if (isEnabled) {
      const copyTextToggleChecked = await settingsManager.get(
        "copyTextToggleChecked"
      );
      const copyScreenshotToggleChecked = await settingsManager.get(
        "copyScreenshotToggleChecked"
      );
      if (copyTextToggleChecked || copyScreenshotToggleChecked) {
        onResumeFromPopup();
      }
    } else {
      onPauseFromPopup();
    }
  });

  settingsManager.addPropertyChangeListener("textDisplay", (textDisplay) => {
    setTextDisplay(textDisplay);
  });

  settingsManager.addPropertyChangeListener(
    "copyTextToggleChecked",
    async (copyTextToggleChecked) => {
      if (!(await settingsManager.isSelectextEnabled())) {
        return;
      }

      const copyScreenshotToggleChecked = await settingsManager.get(
        "copyScreenshotToggleChecked"
      );
      if (copyTextToggleChecked === true) {
        // Show text toggle on all existing overlays
        videoToVideoOverlayMap.forEach((videoOverlayInfo, video) => {
          const videoOverlay = videoOverlayInfo.videoOverlay;
          addToggleToVideoOverlay(video, videoOverlay);
          adjustTogglePos(undefined, video, videoOverlay);
        });
        if (copyScreenshotToggleChecked === false) {
          onResumeFromPopup();
        }
      } else {
        // Remove toggle on all existing overlays
        videoToVideoOverlayMap.forEach((videoOverlayInfo, video) => {
          // Need to get video for videoOverlay using map
          const videoOverlay = videoOverlayInfo.videoOverlay;
          $(videoOverlay).children("#cornerWrapper").remove();
          adjustTogglePos(undefined, video, videoOverlay);
        });

        if (copyScreenshotToggleChecked === false) {
          // on pause from popup except don't remove overlays or play listeners
          onBothOnPauseTogglesTurnedOff();
        }
      }
    }
  );

  settingsManager.addPropertyChangeListener(
    "copyScreenshotToggleChecked",
    async (copyScreenshotToggleChecked) => {
      if (!(await settingsManager.isSelectextEnabled())) {
        return;
      }

      const copyTextToggleChecked = await settingsManager.get(
        "copyTextToggleChecked"
      );
      if (copyScreenshotToggleChecked === true) {
        videoToVideoOverlayMap.forEach((videoOverlayInfo, video) => {
          const videoOverlay = videoOverlayInfo.videoOverlay;
          const screenshotButton = createScreenshotButton(video, videoOverlay);
          videoOverlay.appendChild(screenshotButton);
          adjustTogglePos(undefined, video, videoOverlay);
        });
        if (copyTextToggleChecked === false) {
          onResumeFromPopup();
        }
      } else {
        // Remove screenshot button on all existing overlays
        videoToVideoOverlayMap.forEach((videoOverlayInfo, video) => {
          // Need to get video for videoOverlay using map
          const videoOverlay = videoOverlayInfo.videoOverlay;
          $(videoOverlay).children("#screenshotButton").remove();
          adjustTogglePos(undefined, video, videoOverlay);
        });

        if (copyTextToggleChecked === false) {
          // on pause from popup except don't remove overlays or play listeners
          onBothOnPauseTogglesTurnedOff();
        }
      }
    }
  );
}

async function shouldShowOverlay(settingsManager) {
  return (
    (await settingsManager.isSelectextEnabled()) &&
    ((await settingsManager.get("copyTextToggleChecked")) ||
      (await settingsManager.get("copyScreenshotToggleChecked")))
  );
}

/**
 * Find the first video loaded with js using arrive. Unbind after the first video is found for performance and it is unlikely
 * Youtube will switch to loading more than 1 video per page.
 */
function findVideoAsync() {
  if (!document.arrive) {
    return;
  }
  document.arrive("video", (video) => {
    addVideoEventListeners(video);
  });
}

function videoIsValid(video) {
  let $video = $(video);
  let width = $video.width();
  let height = $video.height();
  let size = width * height;

  // If the video is too small, it is probably not a video
  if (size < MIN_VIDEO_SIZE) {
    return false;
  }

  return true;
}

/**
 * Add pause and play listeners to the HTML video element.
 * @param {Element} video the HTML video element.
 */
function addVideoEventListeners(video) {
  video.addEventListener("pause", onVideoPauseWrapper);
  video.addEventListener("play", onVideoPlayWrapper);
}

function removeVideoEventListeners(video) {
  video.removeEventListener("pause", onVideoPauseWrapper);
  video.removeEventListener("play", onVideoPlayWrapper);
}

function onVideoPauseWrapper(e) {
  onVideoPause(e.target);
}

function onVideoPlayWrapper(e) {
  onVideoPlay(e.target);
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Insert the video overlay and toggle into the DOM when video paused.
 * @param {Element} video the HTML video element.
 */
async function onVideoPause(video) {
  sendAndResetCurrentSelectionInfo();
  if (videoIsValid(video) !== true) {
    return;
  }

  if (video.currentTime === video.duration) {
    return;
  }

  // Wait for 500ms when mouse down to stop toggle showing up when scrubbing on Youtube
  // Still check if the video is paused after 500ms in case pause fires on mousedown and they do a long click for some reason
  if (mouseDown) {
    await timeout(500);
  }
  if (video.paused && getShadowHostForVideo(video) === undefined) {
    const videoOverlay = await createVideoOverlayAndToggle(video);
    const shadowHost = insertOverlayIntoDOM(video, videoOverlay);

    videoToVideoOverlayMap.set(video, {
      videoOverlay: videoOverlay,
      shadowHost: shadowHost,
    });

    resizeVideoOverlay(video, videoOverlay);

    addResizeObserver(video, videoOverlay);

    video.ontimeupdate = () => onScrubWhilePaused(video, videoOverlay);
  }
}

function getShadowHostForVideo(video) {
  const videoOverlayInfo = videoToVideoOverlayMap.get(video);
  if (videoOverlayInfo === undefined) {
    return undefined;
  }
  return videoOverlayInfo.shadowHost;
}

function getVideoOverlayForVideo(video) {
  const videoOverlayInfo = videoToVideoOverlayMap.get(video);
  if (videoOverlayInfo === undefined) {
    return undefined;
  }
  return videoOverlayInfo.videoOverlay;
}

/**
 * Remove the video overlay when the video starts playing again.
 * @param {Element} video the HTML video element.
 */
function onVideoPlay(video) {
  const shadowHost = getShadowHostForVideo(video);
  if (shadowHost !== undefined) {
    shadowHost.remove();
    sendAndResetCurrentSelectionInfo();
  }

  const resizeObserver = getResizeObserverForVideo(video);
  if (resizeObserver !== undefined) {
    resizeObserver.disconnect();
  }

  video.ontimeupdate = undefined;

  videoToVideoOverlayMap.delete(video);
}

async function showScreenshotButton() {
  if (BROWSER_TYPE === "firefox") {
    return false;
  }

  return await settingsManager.get("copyScreenshotToggleChecked") && await settingsManager.get("copyScreenshotUnlocked");
}

function addToggleToVideoOverlay(video, videoOverlay) {
  // Add the panel with the toggle to the top left
  const cornerPanel = createCornerPanel(video, videoOverlay);
  const { toggle, input } = createToggle(video, videoOverlay);
  cornerPanel.appendChild(toggle);
  videoOverlay.appendChild(cornerPanel);

  setTimeout(() => {
    const clickFunc = () => {
      programmaticallyClickToggle(video, videoOverlay);
    };
    ensureToggleIsClickable(video, videoOverlay, toggle, clickFunc);
    videoOverlay.style.setProperty("--sliderTransition", ".4s");
  }, 100);
}

async function createVideoOverlayAndToggle(video) {
  //The HTML element that is overlayed on top of the video element
  var videoOverlay = document.createElement("div");
  videoOverlay.id = "videoOverlay";

  videoOverlay.style.width = "0px";
  videoOverlay.style.height = "0px";

  videoOverlay.style.position = "absolute";

  $(videoOverlay).data("activated", false);

  if (await settingsManager.get("copyTextToggleChecked")) {
    addToggleToVideoOverlay(video, videoOverlay);
  }

  if (await showScreenshotButton()) {
    const screenshotButton = createScreenshotButton(video, videoOverlay);
    videoOverlay.appendChild(screenshotButton);
  }

  const textDisplay = await settingsManager.get("textDisplay");
  if (textDisplay === "transparent") {
    videoOverlay.classList.add("transparent");
  }

  return videoOverlay;
}

function createScreenshotButton(video, videoOverlay) {
  const screenshotButton = document.createElement("div");
  screenshotButton.addEventListener("click", (e) => e.stopPropagation());
  screenshotButton.id = "screenshotButton";
  screenshotButton.style.visibility = "hidden";

  setTimeout(() => {
    if (screenshotButton.dataset.capturing !== "true") {
      screenshotButton.style.removeProperty("visibility");
    }
  }, 50);

  const cameraIcon = document.createElement("img");
  cameraIcon.src = browser.runtime.getURL("images/camera.svg");
  cameraIcon.id = "cameraIcon";

  screenshotButton.appendChild(cameraIcon);

  setTimeout(() => {
    const clickFunc = () => {
      if (inIframe()) {
        // Get the offset of the iframe to the current window with postmessage
        let onIframeDimensionsResponse = (e) => {
          if (e.data.type == "SELECTEXT_IFRAME_DIMENSIONS_RESPONSE") {
            const iframeDimensions = e.data.iframeDimensions;
            copyVideoFrameScreenshot(
              video,
              e.data.viewportDimensions,
              iframeDimensions.left,
              iframeDimensions.top
            );
            window.removeEventListener("message", onIframeDimensionsResponse);
          }
        };

        window.addEventListener("message", onIframeDimensionsResponse);

        window.top.postMessage(
          {
            type: "SELECTEXT_IFRAME_DIMENSIONS_REQUEST",
            iframeSrc: window.location.href,
          },
          "*"
        );
      } else {
        copyVideoFrameScreenshot(video);
      }
    };

    ensureToggleIsClickable(video, videoOverlay, screenshotButton, clickFunc);
  }, 100);

  return screenshotButton;
}

/**
 * Create the corner panel and return it
 * @returns {HTMLDivElement} The HTML image of the logo
 */
function createCornerPanel(video, videoOverlay) {
  const cornerWrapper = document.createElement("div");
  cornerWrapper.addEventListener("click", (event) => event.stopPropagation());
  cornerWrapper.id = "cornerWrapper";
  cornerWrapper.style.visibility = "hidden";

  // Hide the toggle for 10ms to stop checkbox flickering on screen from shadow dom weird load
  setTimeout(() => {
    if (cornerWrapper.dataset.capturing !== "true") {
      cornerWrapper.style.removeProperty("visibility");
    }
  }, 50);

  return cornerWrapper;
}

/**
 * Creates the toggle HTML element
 * @returns {HTMLLabelElement} the toggle HTML element
 */
function createToggle(video, videoOverlay) {
  let toggle = document.createElement("label");
  toggle.id = "outerToggle";
  toggle.className = "switch";

  const input = document.createElement("input");
  input.id = "selecTextToggle";
  input.type = "checkbox";
  input.checked = $(videoOverlay).data("activated");

  const span = document.createElement("span");
  span.className = "slider round";

  toggle.appendChild(input);
  toggle.appendChild(span);

  return {
    toggle: toggle,
    input: input,
  };
}

/**
 * Inject the video overlay on top of the video, but ensure the controls are still usable.
 * @param {Element} video the HTML video element.
 * @param {Element} videoOverlay the HTML video overlay element.
 */
function insertOverlayIntoDOM(video, videoOverlay) {
  // Create the shadow root to isolate styles from webpage
  let shadowHost = document.createElement("DIV");
  shadowHost.className = "selectextShadowHost";
  shadowHost.attachShadow({ mode: "open" });
  let shadowRoot = shadowHost.shadowRoot;

  // Add the videoOverlay to the shadowRoot
  shadowRoot.appendChild(videoOverlay);

  // Add style sheets to shadowroot
  addStyleSheet(shadowRoot, "shadow.css");
  addStyleSheet(shadowRoot, "login.css");

  // Insert video overlay
  video.parentNode.insertBefore(shadowHost, video.nextSibling);

  return shadowHost;
}

function ensureToggleIsClickable(video, videoOverlay, toggle, clickFunc) {
  let toggleClickHandlerClick = (e) =>
    toggleClickCapturer(e, video, videoOverlay, toggle, true, clickFunc);
  let toggleClickHandlerNoClick = (e) =>
    toggleClickCapturer(e, video, videoOverlay, toggle, false, clickFunc);

  if (toggle.getAttribute("click") !== "true") {
    document.addEventListener("click", toggleClickHandlerNoClick, true);
  }

  if (toggle.getAttribute("mousedown") !== "true") {
    document.addEventListener("mousedown", toggleClickHandlerClick, true);
  }

  if (toggle.getAttribute("mouseup") !== "true") {
    document.addEventListener("mouseup", toggleClickHandlerNoClick, true);
  }

  video.addEventListener(
    "play",
    () => {
      document.removeEventListener("click", toggleClickHandlerNoClick, true);
      document.removeEventListener("mousedown", toggleClickHandlerClick, true);
      document.removeEventListener("mouseup", toggleClickHandlerNoClick, true);
    },
    { once: true }
  );
}

function toggleClickCapturer(
  e,
  video,
  videoOverlay,
  toggle,
  isClick,
  clickFunc
) {
  if (toggle === null || toggle === undefined) {
    return;
  }

  toggle.setAttribute(e.type, "true");

  let togglePos = toggle.getBoundingClientRect();

  if (togglePos.width === 0 || togglePos.height === 0) {
    return;
  }

  let clickX = e.clientX;
  let clickY = e.clientY;

  if (clickX === 0 || clickY === 0) {
    return;
  }

  // If the click is inside the bounding rect of the toggle
  if (
    clickX >= togglePos.left &&
    clickX <= togglePos.right &&
    clickY >= togglePos.top &&
    clickY <= togglePos.bottom
  ) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();

    if (isClick === true) {
      clickFunc();
    }
  }
}

function programmaticallyClickToggle(video, videoOverlay) {
  const isActivated = !$(videoOverlay).data("activated");
  $(videoOverlay).data("activated", isActivated);

  let input = queryShadowRoot("#selecTextToggle", false, videoOverlay);
  if (input !== null) {
    input.checked = isActivated;
  }

  let activate = new Event("activate");
  videoOverlay.dispatchEvent(activate);
  onToggleClick(video, videoOverlay, isActivated);
}

function addStyleSheet(element, styleSheetPath) {
  // Add style from login.css to the shadowRoot
  var styleSheetURL = browser.runtime.getURL(styleSheetPath);
  $(element).append(
    $("<link>")
      .attr("rel", "stylesheet")
      .attr("type", "text/css")
      .attr("href", styleSheetURL)
  );
}

/**
 * Perform logic when the toggle is clicked.
 * @param {Element} video the HTML video element
 * @param {Element} videoOverlay the HTML video overlay element
 * @param {Event} event the click event.
 */
function onToggleClick(video, videoOverlay, checked) {
  if (checked !== undefined) {
    // Query the current elements showing in the overlay
    let textWrapper = queryShadowRoot("#textWrapper", false, videoOverlay);
    let loader = queryShadowRoot("#selecTextLoader", false, videoOverlay);
    let message = queryShadowRoot("#persistentMessage", false, videoOverlay);
    let loginWrapper = queryShadowRoot(
      ".selectextLoginWrapper",
      false,
      videoOverlay
    );
    let limitWrapper = queryShadowRoot(
      ".selectextLimitWrapper",
      false,
      videoOverlay
    );
    let reviewWrapper = queryShadowRoot(
      ".selectextReviewWrapper",
      false,
      videoOverlay
    );

    //The toggle was turned on
    if (checked === true) {
      if (
        textWrapper === null &&
        loader === null &&
        message === null &&
        loginWrapper === null &&
        limitWrapper === null &&
        reviewWrapper === null
      ) {
        selectextActivated(video, videoOverlay);
      } else {
        // Show the text wrapper and/or loader
        if (textWrapper !== null) {
          textWrapper.style.removeProperty("visibility");
        } else if (loader !== null) {
          loader.style.removeProperty("visibility");
          // Show a message again if it is persistent
        } else if (message !== null) {
          let oldText = message.innerText;
          message.remove();
          showFadingMessage(oldText, 2000, true, null, videoOverlay, video);
        } else if (loginWrapper !== null) {
          loginWrapper.style.removeProperty("visibility");
        } else if (limitWrapper !== null) {
          limitWrapper.style.removeProperty("visibility");
        }
        if (reviewWrapper !== null) {
          reviewWrapper.style.removeProperty("visibility");
        }
      }

      // The toggle was turned off
    } else if (checked === false) {
      // Hide the text wrapper and/or loader
      if (loader !== null) {
        loader.style.visibility = "hidden";
      }
      if (textWrapper !== null) {
        textWrapper.style.visibility = "hidden";
      }
      if (loginWrapper !== null) {
        loginWrapper.style.visibility = "hidden";
      }
      if (limitWrapper !== null) {
        limitWrapper.style.visibility = "hidden";
      }
      if (reviewWrapper !== null) {
        reviewWrapper.style.visibility = "hidden";
      }
    }
  }
}

/**
 * Capture the current video frame, perform OCR, and render the HTML text on top of the video.
 * @param {Element} video the HTML video element
 * @param {Element} videoOverlay the HTML video overlay element
 */
function selectextActivated(video, videoOverlay) {
  addResizeObserver(video, videoOverlay);

  detectAndRenderText(video, videoOverlay);
}

/**
 * Get the position of the video in the viewport, used for cropping the browser screenshot
 * @param {Element} video the HTML video element
 * @returns {Object} the object containing video position as returned by getBoundingClientRect
 */
function getScreenPositionOfVideo(video) {
  let rect = video.getBoundingClientRect();
  let { leftOffset, topOffset } = getBlackBarOffset(video);

  return {
    top: rect.top + topOffset,
    left: rect.left + leftOffset,
    width: rect.width - leftOffset * 2,
    height: rect.height - topOffset * 2,
  };
}

function getViewportDimensions() {
  const vw = Math.max(
    document.documentElement.clientWidth || 0,
    window.innerWidth || 0
  );
  const vh = Math.max(
    document.documentElement.clientHeight || 0,
    window.innerHeight || 0
  );

  return {
    width: vw,
    height: vh,
  };
}

(function ($) {
  var timeout;
  $(document).on("mousemove", function (event) {
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
    }
    timeout = window.setTimeout(function () {
      // trigger the new event on event.target, so that it can bubble appropriately
      $(event.target).trigger("mousemoveend");
    }, 1000);
  });
})(jQuery);

function diamondDrillOnMouseMove(video, videoOverlay) {
  const onMouseMove = (e) => {
    setTimeout(() => {
      const videoBoundingRect = video.getBoundingClientRect();
      if (
        e.clientX > videoBoundingRect.left &&
        e.clientX < videoBoundingRect.right &&
        e.clientY > videoBoundingRect.top &&
        e.clientY < videoBoundingRect.bottom
      ) {
        const textWrapper = queryShadowRoot(
          "#textWrapper",
          false,
          videoOverlay
        );
        textWrapperDiamondDrill(textWrapper, video, videoOverlay);
      }
    }, 50);
  };

  document.addEventListener("mousemove", onMouseMove, { once: true });
  return onMouseMove;
}

function mouseMoveDiamondDrillHacks(video, videoOverlay) {
  const onMouseMove = diamondDrillOnMouseMove(video, videoOverlay);
  const onMouseMoveEnd = (event) =>
    diamondDrillOnMouseMove(video, videoOverlay);
  $(document).on("mousemoveend", onMouseMoveEnd);

  video.addEventListener(
    "play",
    () => {
      document.removeEventListener("mousemove", onMouseMove);
      $(document).off("mousemoveend");
    },
    { once: true }
  );

  $(videoOverlay).on("activate", (e) => {
    if ($(e.target).data("activated")) {
      const onMouseMoveEnd = (event) =>
        diamondDrillOnMouseMove(video, videoOverlay);
      $(document).on("mousemoveend", onMouseMoveEnd);
    } else {
      document.removeEventListener("mousemove", onMouseMove);
      $(document).off("mousemoveend");
    }
  });
}

/**
 * Detect the text, and render it on top of the video
 * @param {Element} video the HTML video element
 * @param {Element} videoOverlay the HTML video overlay element
 * @param {Element} spinner the spinner HTML element
 */
function detectAndRenderText(video, videoOverlay) {
  const timeOfButtonPress = video.currentTime;

  // Get the position of the video in the viewport
  const videoPosition = getScreenPositionOfVideo(video);
  const quality = 1.0;

  const loginListener = (request) => {
    if (request.type !== undefined) {
      if (request.type === "login") {
        showLoginPopup(videoOverlay, video);
      } else if (request.type === "login_success") {
        queryShadowRoot(".selectextLoginWrapper", true, videoOverlay).remove();
        addSpinner(videoOverlay);
      }
    }
  };

  browser.runtime.onMessage.addListener(loginListener);

  if (inIframe()) {
    // Get the offset of the iframe to the current window with postmessage
    let onIframeDimensionsResponse = (e) => {
      if (
        e.data !== undefined &&
        e.data.type == "SELECTEXT_IFRAME_DIMENSIONS_RESPONSE"
      ) {
        const iframeDimensions = e.data.iframeDimensions;
        videoPosition.left += iframeDimensions.left;
        videoPosition.top += iframeDimensions.top;

        const viewportDimensions = e.data.viewportDimensions;
        doOCR(
          videoPosition,
          viewportDimensions,
          quality,
          videoOverlay,
          video,
          loginListener,
          timeOfButtonPress
        );
        window.removeEventListener("message", onIframeDimensionsResponse);
      }
    };

    window.addEventListener("message", onIframeDimensionsResponse);

    window.top.postMessage(
      {
        type: "SELECTEXT_IFRAME_DIMENSIONS_REQUEST",
        iframeSrc: window.location.href,
      },
      "*"
    );
  } else {
    const viewportDimensions = getViewportDimensions();
    doOCR(
      videoPosition,
      viewportDimensions,
      quality,
      videoOverlay,
      video,
      loginListener,
      timeOfButtonPress
    );
  }
}

function isCanvasBlank(canvas) {
  const context = canvas.getContext("2d");

  const pixelBuffer = new Uint32Array(
    context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
  );

  const res = !pixelBuffer.some((color) => color !== 0);
  return res;
}

function canvasCaptureSiteListIncludesThisSite() {
  const siteName = getSiteNameFromURL(window.location.href);
  for (let canvasCaptureSite of CANVAS_CAPTURE_SITE_LIST) {
    if (siteName.endsWith(canvasCaptureSite)) {
      return true;
    }
  }
  return false;
}

function getImageScaleFactor(maxFrameWidth, width) {
  let scaleFactor = 1;
  if (width > maxFrameWidth) {
    scaleFactor = maxFrameWidth / width;
  }
  return scaleFactor;
}

function scheduleReviewPopup(res) {
  if (res.showReviewPrompt === true) {
    settingsManager.set({ showReviewPrompt: true });
  }
}

async function withVideoOverlayHidden(video, func, onlyHideScreenshotButton) {
  const messageShadowHost = getMessageShadowHostForVideo(video).get(0);

  let screenshotButton;
  let fadingMessage;

  let shadowHost = getShadowHostForVideo(video);
  const videoOverlay = getVideoOverlayForVideo(video);
  if (shadowHost !== undefined) {
    videoOverlay.style.setProperty("--sliderTransition", "0s");
    if (!onlyHideScreenshotButton) {
      shadowHost.style.visibility = "hidden";
    }
  }
  if (onlyHideScreenshotButton) {
    screenshotButton = queryShadowRoot(
      "#screenshotButton",
      false,
      videoOverlay
    );
    if (screenshotButton !== null) {
      screenshotButton.dataset.capturing = "true";
      screenshotButton.style.visibility = "hidden";
    }

    fadingMessage = queryShadowRoot(".alertMessage", false, videoOverlay);
    if (fadingMessage !== null) {
      fadingMessage.style.visibility = "hidden";
    }
  }

  if (messageShadowHost !== undefined) {
    messageShadowHost.style.visibility = "hidden";
  }

  await new Promise((resolve) => setTimeout(resolve, 50));

  const returnValue = await func();

  if (shadowHost !== undefined) {
    videoOverlay.style.setProperty("--sliderTransition", ".4s");
    if (!onlyHideScreenshotButton) {
      shadowHost.style.removeProperty("visibility");
    }
  }

  if (screenshotButton !== undefined && screenshotButton !== null) {
    screenshotButton.style.removeProperty("visibility");
    delete screenshotButton.dataset.capturing;
  }

  if (fadingMessage !== undefined && fadingMessage !== null) {
    fadingMessage.style.removeProperty("visibility");
  }


  if (messageShadowHost !== undefined) {
    messageShadowHost.style.removeProperty("visibility");
  }

  return returnValue;
}

async function captureVideoFrame(
  video,
  videoPosition,
  viewportDimensions,
  outputFormat,
  quality = 1.0,
  onlyHideScreenshotButton = false
) {
  async function inner(retrying = false) {
    let canvas;
    let outputScaleFactor;

    if (canvasCaptureSiteListIncludesThisSite() && retrying === false) {
      ({ canvas: canvas, outputScaleFactor: outputScaleFactor } =
        await drawVideoFrameToCanvas(video, videoPosition));
    } else {
      const pageDataURI = await withVideoOverlayHidden(
        video,
        async () =>
          await browser.runtime.sendMessage({
            type: "capture",
          }),
        onlyHideScreenshotButton
      );

      if (pageDataURI === null) {
        return null;
      }

      ({ canvas: canvas, outputScaleFactor: outputScaleFactor } =
        await cropPageDataUriToVideoFrameCanvas(
          videoPosition,
          viewportDimensions,
          pageDataURI
        ));
    }

    let output = { outputScaleFactor: outputScaleFactor };

    if (outputFormat === "dataUri") {
      const rawDataUri = canvas.toDataURL("image/jpeg", quality);
      output.dataUri = rawDataUri.substring(rawDataUri.indexOf(",") + 1);
    } else if (outputFormat === "dataUriPng") {
      output.dataUri = canvas.toDataURL("image/png", quality);
    } else if (outputFormat === "blob") {
      output.blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png", quality);
      });
    } else if (outputFormat === "arrayBuffer") {
      output.arrayBuffer = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height);
    }

    return output;
  }

  try {
    return await inner();
  } catch (e) {
    return await inner(true);
  }
}

function handleVideoScreenshotEnabling(hasVideoScreenshot) {
  if (hasVideoScreenshot === null || hasVideoScreenshot === undefined) {
    return;
  }
  
  if (hasVideoScreenshot === true) {
    settingsManager.get("copyScreenshotUnlocked").then(
      (previousSetting) => {
        if (previousSetting !== true) {
          settingsManager.set({"copyScreenshotToggleChecked": true, "copyScreenshotKeyboardShortcutChecked": true});
        } 

        settingsManager.set({"copyScreenshotUnlocked": true});
      }
    )
  } else {
    settingsManager.set({"copyScreenshotUnlocked": false, "copyScreenshotToggleChecked": false, "copyScreenshotKeyboardShortcutChecked": false});
  }
}

async function doOCR(
  videoPosition,
  viewportDimensions,
  quality,
  videoOverlay,
  video,
  loginListener,
  timeOfButtonPress
) {
  // Send the dataUri representing the current video frame to the background script to handle performing OCR
  let videoDataUri;
  let outputScaleFactor;

  ({ dataUri: videoDataUri, outputScaleFactor: outputScaleFactor } =
    await captureVideoFrame(
      video,
      videoPosition,
      viewportDimensions,
      "dataUri",
      quality,
      true
    ));

  addSpinner(videoOverlay);

  browser.runtime
    .sendMessage({
      type: "ocr",
      dataURI: videoDataUri,
      url: window.location.href,
    })
    .then((response) => {
      const processResponse = (res) => {
        handleVideoScreenshotEnabling(res.hasVideoScreenshot);

        browser.runtime.onMessage.removeListener(loginListener);

        scheduleReviewPopup(res);

        // If the video is still paused in the same place once OCR is finished
        if (timeOfButtonPress === video.currentTime) {
          let textAnnotations = processOCRAPICall(res, videoOverlay, video);

          if (textAnnotations !== undefined) {
            let simpleAnnotations = OCRAnnotationsMapper(textAnnotations);
            let detectedLanguages =
              getDetectedLanguagesFromOCRFullTextAnnotations(textAnnotations);
            let textWrapper = drawText(
              video,
              videoOverlay,
              simpleAnnotations,
              videoPosition,
              outputScaleFactor
            );

            if (textWrapper !== undefined) {
              textWrapperDiamondDrill(textWrapper, video, videoOverlay);
            }

            mouseMoveDiamondDrillHacks(video, videoOverlay);

            resizeVideoOverlay(video, videoOverlay);

            addResizeObserver(
              video,
              videoOverlay,
              simpleAnnotations,
              videoPosition,
              outputScaleFactor
            );
            initCurrentSelectionInfo(timeOfButtonPress, detectedLanguages);
          }
        }

        queryShadowRoot("#selecTextLoader", true, videoOverlay).remove();
      };
      if (response === "login") {
        const ocrDoneListener = (res) => {
          if (res.type !== undefined && res.type === "OCR") {
            processResponse(res.json);
            browser.runtime.onMessage.removeListener(ocrDoneListener);
          }
        };
        browser.runtime.onMessage.addListener(ocrDoneListener);
      } else if (
        response.type !== undefined &&
        response.type === "limitExceeded"
      ) {
        showOutOfCreditsPopup(
          video,
          videoOverlay,
          response.limit,
          response.planIsFree
        );
      } else if (response === "error") {
        showFadingMessage(
          "Failed to detect text. Please check your internet connection.",
          2000,
          false,
          null,
          videoOverlay,
          video
        );
        queryShadowRoot("#selecTextLoader", true, videoOverlay).remove();
      } else {
        processResponse(response);
      }
    });

  if ((await settingsManager.get("showReviewPrompt")) === true) {
    showReviewPopup(videoOverlay, video);
    settingsManager.remove("showReviewPrompt");
  }
}

async function drawVideoFrameToCanvas(video, videoPosition) {
  //Draw the video's current frame onto a canvas
  var canvas = document.createElement("CANVAS");

  const inputScaleFactor = getImageScaleFactor(
    MAX_VIDEO_FRAME_WIDTH,
    video.videoWidth
  );

  // Note that videoWidth could be 0 in which case this would fail
  // As long as we only enable this on sites that are fine, this should be all good
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  const finalWidth = videoWidth * inputScaleFactor;
  const finalHeight = videoHeight * inputScaleFactor;

  canvas.width = finalWidth;
  canvas.height = finalHeight;

  canvas.getContext("2d").drawImage(video, 0, 0, finalWidth, finalHeight);

  return {
    canvas: canvas,
    outputScaleFactor: videoPosition.width / finalWidth,
  };
}

function showOutOfCreditsPopup(video, videoOverlay, limit, planIsFree) {
  if (
    queryShadowRoot(".selectextLimitWrapper", true, videoOverlay).length > 0
  ) {
    return;
  }
  const limitPage = browser.runtime.getURL("limit.html");

  const $limitWrapper = $('<div class="selectextLimitWrapper"></div>');

  $limitWrapper
    .appendTo($(videoOverlay))
    .load(limitPage, () => onLimitLoaded(videoOverlay, limit, planIsFree));

  $limitWrapper.click((e) => e.stopPropagation());
  $limitWrapper.mousedown((e) => e.stopPropagation());
  $limitWrapper.mouseup((e) => e.stopPropagation());

  queryShadowRoot("#selecTextLoader", true, videoOverlay).remove();

  setTimeout(
    () => limitWrapperDiamondDrill($limitWrapper, video, videoOverlay),
    200
  );
}

function limitWrapperDiamondDrill(limitWrapper, video, videoOverlay) {
  const upgradeButton = limitWrapper.find(".upgradeButton").get(0);

  if (upgradeButton !== undefined) {
    ensureTextWrapperIsClickable(upgradeButton, video, videoOverlay);
  }
}

/**
 * Query element(s) in the selectext shadow root
 * @param {String} selector the CSS selector used to find the element(s)
 * @param {Boolean} isJquery if true, the element(s) will be returned as a Jquery object, otherwise a JS element
 * @param {Element} queryRoot an element to call 'find' with
 * @returns A Jquery Object or JS element(s) found by the selector
 */
function queryShadowRoot(selector, isJquery = true, queryRoot = null) {
  if (queryRoot === null) {
    let shadowHost = $(".selectextShadowHost");

    if (shadowHost.length === 0) {
      if (isJquery === true) {
        return shadowHost;
      } else {
        return null;
      }
    }

    // Get all shadow roots inside shadowhosts Jquery object as a jquery object
    queryRoot = $(shadowHost.get().map((shadowHost) => shadowHost.shadowRoot));
  } else {
    queryRoot = $(queryRoot);
  }

  let jqueryCollection = queryRoot.find(selector);

  if (isJquery === true) {
    return jqueryCollection;
  } else {
    if (jqueryCollection.length > 1) {
      return jqueryCollection.get();
    } else if (jqueryCollection.length != 0) {
      return jqueryCollection.get(0);
    } else {
      return null;
    }
  }
}

/**
 * Process the response from the Selectext OCR API to determine how to proceed.
 * @param {JSON} response the JSON response from the Selectext OCR API
 * @return textAnnotations the array of JSON object representing the text nodes in the format returned by the
 * Selectext OCR API.
 */
function processOCRAPICall(response, videoOverlay, video) {
  if (response.error) {
    showFadingMessage(response.error, 7000, true, null, videoOverlay, video);
    return;
  }

  if (response.responses === undefined) {
    showFadingMessage(
      "Text was unable to be detected.",
      7000,
      true,
      null,
      videoOverlay,
      video
    );
    return;
  }

  // The array of JSON information about each text node.
  var textAnnotations = response.responses[0].fullTextAnnotation;

  //There is no text found
  if (textAnnotations === undefined) {
    showFadingMessage(
      "No text detected",
      2000,
      true,
      null,
      videoOverlay,
      video
    );
    return;
  }

  return textAnnotations;
}

function getDetectedLanguagesFromOCRFullTextAnnotations(fullTextAnnotations) {
  const pages = _.get(fullTextAnnotations, "pages", []);
  let detectedLanguages = [];
  for (const page of pages) {
    let pageDetectedLanguages = _.get(page, "property.detectedLanguages", []);
    for (const detectedLanguage of pageDetectedLanguages) {
      if (detectedLanguage.confidence > 0.5) {
        detectedLanguages.push(detectedLanguage.languageCode);
      }
    }
  }
  return detectedLanguages;
}

function OCRAnnotationsMapper(fullTextAnnotations) {
  const annotations = [];

  const pages = _.get(fullTextAnnotations, "pages", []);

  for (const page of pages) {
    let blocks = page.blocks;
    for (const [blockId, block] of blocks.entries()) {
      let paragraphs = block.paragraphs;
      for (const paragraph of paragraphs) {
        let words = paragraph.words;
        for (const word of words) {
          let symbols = word.symbols;

          let wordText = "";
          for (const symbol of symbols) {
            let character = symbol.text;
            wordText += character;
          }

          let lastSymbol = symbols[symbols.length - 1];
          let wordDetectedBreakType = _.get(
            lastSymbol,
            "property.detectedBreak.type",
            "NO_SPACE"
          );
          let wordDetectedBreakChar = getDetectedBreakCharFromType(
            wordDetectedBreakType
          );

          // Cloud vision skips y coordinate if it is 0. I assume same for X coord.
          // Hopefully item at 0,0 isn't ommitted altogether
          let wordBoundingBox = [];
          for (const corner of word.boundingBox.vertices) {
            if (corner.x === undefined) {
              corner.x = 0;
            }

            if (corner.y === undefined) {
              corner.y = 0;
            }

            wordBoundingBox.push(corner);
          }

          annotations.push({
            text: wordText,
            boundingBox: wordBoundingBox,
            break: wordDetectedBreakChar,
            blockId: blockId,
          });
        }
      }
    }
  }

  return {
    annotations: annotations,
    fullText: _.get(fullTextAnnotations, "text", ""),
  };
}

function getDetectedBreakCharFromType(type) {
  if (type === "SPACE" || type === "SURE_SPACE") {
    return " ";
  } else if (type === "NO_SPACE" || type === "HYPHEN") {
    return "";
  } else {
    return "\n";
  }
}

/**
 * Generate HTML representing selectable text and insert it into the DOM in front of the video.
 * @param {Element} video the HTML video element.
 * @param {Element} videoOverlay the HTML div element overlaid on top of the video.
 * @param {Array} textAnnotations the array of JSON object representing the text nodes in the format returned by
 * the Selectext OCR API.
 */
function drawText(
  video,
  videoOverlay,
  textAnnotations,
  videoPosition,
  initalScaleFactor
) {
  let newPos = getScreenPositionOfVideo(video);
  let width = newPos.width;

  // The change in size between what the video was initially, and what it is now
  var scaleFactor = (width / videoPosition.width) * initalScaleFactor;

  let textWrapper = document.createElement("div");
  textWrapper.id = "textWrapper";

  videoOverlay.appendChild(textWrapper);

  let annotations = textAnnotations.annotations;

  annotations.forEach((annotation, i) => {
    annotation.id = i;
  });
  let selectable = enableDragSelect(
    textWrapper,
    videoOverlay,
    video,
    annotations
  );

  stopDragSelectResumingVideo(textWrapper, selectable);

  let { leftOffset, topOffset } = getBlackBarOffset(video);

  //Loop through text annotations returned by the OCR API and add them to the video overlay div as divs with text inside
  for (var i = 0; i < annotations.length; i++) {
    let annotation = annotations[i];

    //Create green highlight colour div containing invisible text
    let textDiv = document.createElement("div");
    textDiv.style.visibility = "hidden";
    textWrapper.appendChild(textDiv);

    textDiv.dataset.id = annotation.id;
    textDiv.className = "selectextText";

    let text = annotation.text;
    // Use this instead of innerHTML to avoid XSS
    let textNode = document.createElement("span");
    textNode.textContent = text;

    textDiv.appendChild(textNode);
    selectable.add(textDiv);

    //The font size of the text based on the height of the bounding box
    let fontSize =
      (annotation.boundingBox[2].y - annotation.boundingBox[0].y) * scaleFactor;

    textDiv.style.fontSize = `${fontSize}px`;
    textDiv.style.lineHeight = `${fontSize * 1.05}px`;

    let detectedWidth =
      (annotation.boundingBox[1].x - annotation.boundingBox[0].x) * scaleFactor;

    textDiv.style.width = `${detectedWidth}px`;

    setTimeout(() => {
      let actualWidth = $(textNode).width();
      let actualHeight = $(textDiv).height();

      let borderWidth = Math.floor(1 + actualHeight / 30);
      if (borderWidth > 2) {
        borderWidth = 2;
      }
      let stretchFactor = detectedWidth / actualWidth;
      textNode.style.transform = `scale(${stretchFactor}, 1)`;

      let differenceInDetectedAndActualHeight = actualHeight - fontSize;
      textDiv.style.top = `${
        annotation.boundingBox[0].y * scaleFactor -
        differenceInDetectedAndActualHeight / 2 -
        borderWidth +
        topOffset
      }px`;
      textDiv.style.left = `${
        annotation.boundingBox[0].x * scaleFactor + leftOffset - borderWidth
      }px`;

      textDiv.style.borderWidth = borderWidth + "px";

      textDiv.style.removeProperty("visibility");
    }, 10);
  }

  // Don't show the text if the toggle was turned off
  if (!$(videoOverlay).data("activated")) {
    textWrapper.style.visibility = "hidden";
  }

  let reviewWrapper = queryShadowRoot(
    ".selectextReviewWrapper",
    false,
    videoOverlay
  );
  if (reviewWrapper !== null) {
    textWrapper.style.visibility = "hidden";
  }

  return textWrapper;
}

function textWrapperDiamondDrill(textWrapper, video, videoOverlay) {
  if (textWrapper === null || textWrapper === undefined) {
    return;
  }

  let points = generateListOfPoints(textWrapper);
  for (var i = 0; i < points.length; i++) {
    ensureTextWrapperIsClickable(textWrapper, video, videoOverlay, points[i]);
  }
}

function generateListOfPoints(textWrapper) {
  const rect = textWrapper.getBoundingClientRect();

  let center = {
    top: (rect.top + rect.bottom) / 2,
    left: (rect.left + rect.right) / 2,
  };

  let topLeft = {
    top: (rect.top + center.top) / 2,
    left: (rect.left + center.left) / 2,
  };

  let topRight = {
    top: (rect.top + center.top) / 2,
    left: (rect.right + center.left) / 2,
  };

  let bottomLeft = {
    top: (rect.bottom + center.top) / 2,
    left: (rect.left + center.left) / 2,
  };

  let bottomRight = {
    top: (rect.bottom + center.top) / 2,
    left: (rect.right + center.left) / 2,
  };

  let topMiddle = {
    top: rect.top + 10,
    left: center.left,
  };

  return [center, topLeft, topRight, bottomLeft, bottomRight, topMiddle];
}

/**
 * Set pointer-events none to all element that are blocking the center of the video from being clickable
 * @param {Element} textWrapper the HTML textWrapper element
 */
function ensureTextWrapperIsClickable(
  textWrapper,
  video,
  videoOverlay,
  point = null
) {
  // Get the point in the center of video
  if (point === null) {
    point = {};
    const rect = textWrapper.getBoundingClientRect();
    point.top = (rect.top + rect.bottom) / 2;
    point.left = (rect.left + rect.right) / 2;
  }

  if (point.top == 0 || point.left == 0) {
    return;
  }

  // Ensure we don't get stuck in infinite loop from a bug
  const maxRemoveClick = 100;
  let i = 0;
  let $elem = "start";

  // Make sure the shadow host is there to avoid infinite loop
  if (getShadowHostForVideo(video) === undefined) {
    return;
  }

  // Maintain a Jquery object of all the elements that we set pointer-events none on
  let blockingElements = [];

  while ($elem === "start" || ($elem.length && i < maxRemoveClick)) {
    // Find the front element at the center of video
    $elem = $(document.elementFromPoint(point.left, point.top));

    // Dont stop click if it is the text wrapper
    if (
      $elem.is(textWrapper) ||
      $elem.is(".selectextShadowHost") ||
      $elem.is("video")
    ) {
      textWrapper.style.pointerEvents = "auto";
      break;
    }

    // Stop the element in the way blocking clicks
    let initialPointerEvents = $elem.data("initalPointerEvents");
    if (!initialPointerEvents) {
      initialPointerEvents = $elem.css("pointer-events");
    }

    blockingElements.push({
      el: $elem,
      pointerEventsInitial: initialPointerEvents,
    });
    $elem.css("pointer-events", "none");

    // Set all children to pointer events auto if they haven't already been set to none
    $elem.find("*").each(function () {
      if (!this.style.pointerEvents || this.style.pointerEvents != "none") {
        let $this = $(this);
        if (!$this.data("initalPointerEvents")) {
          $this.data("initalPointerEvents", $this.css("pointer-events"));
        }
        this.style.pointerEvents = "auto";
      }
    });

    i++;
  }

  // Set pointer events back to auto on blocking elements when the video is resumed and when the video is paused just in case
  video.addEventListener(
    "play",
    () => resetBlockingElementsToInitialPointerEvents(blockingElements),
    { once: true }
  );

  $(videoOverlay).on("activate", (e) => {
    if ($(e.target).data("activated")) {
      blockingElements.forEach((element) => {
        element.el.css("pointer-events", "none");
      });
    } else {
      // If the toggle is turned off, make all the blocking elements clickable again
      resetBlockingElementsToInitialPointerEvents(blockingElements);
    }
  });
}

function resetBlockingElementsToInitialPointerEvents(blockingElements) {
  blockingElements.forEach((element) => {
    element.el.css("pointer-events", element.pointerEventsInitial);
  });
}

/**
 * Find the size of the black bars on the video. This is required for accurately drawing the text when the video
 * has black bars
 * @param {Element} video the HTML video element.
 * @return {Object} the int size (px) of the black bars on the top and left of the video
 */
function getBlackBarOffset(video) {
  // Ratio of the video's intrisic dimensions
  let videoWidth = video.videoWidth;
  let videoHeight = video.videoHeight;
  if (videoWidth === 0 || videoHeight === 0) {
    return {
      leftOffset: 0,
      topOffset: 0,
    };
  }
  let videoRatio = videoWidth / videoHeight;
  // The width and height of the video element
  let width = video.offsetWidth;
  let height = video.offsetHeight;
  // The ratio of the element's width to its height
  let elementRatio = width / height;

  let left = 0;
  let top = 0;
  // If the video element is short and wide
  if (elementRatio > videoRatio) {
    left = (width - height * videoRatio) / 2;
  } else {
    top = (height - width / videoRatio) / 2;
  }

  return {
    leftOffset: left,
    topOffset: top,
  };
}

/**
 * Adds the drag select behaviour
 * @param {string} fullText the string off the full text returned by the Selectext OCR API
 */
function enableDragSelect(textWrapper, videoOverlay, video, annotations) {
  let $textWrapper = $(textWrapper);

  const selectable = new Selectable({
    appendTo: $textWrapper.get(0),
  });
  selectable.on("end", () =>
    processSelectedWords(selectable, videoOverlay, video, annotations)
  );

  $textWrapper.click((e) => e.stopPropagation());
  $textWrapper.mousedown((e) => e.stopPropagation());
  $textWrapper.mouseup((e) => e.stopPropagation());
  return selectable;
}

function getBoundingBoxFromSelectableRect(rect) {
  return {
    top: rect.y1,
    left: rect.x1,
    bottom: rect.y2,
    right: rect.x2,
    height: rect.height,
    width: rect.width,
  };
}

function getAnnotationById(annotations, id) {
  for (const annotation of annotations) {
    // Intentionally double equals as we are comparing int with string and ceebs casting
    if (annotation.id == id) {
      return annotation;
    }
  }
}

function getAllSelectedBoxes(selectable, annotations) {
  const els = selectable.getSelectedItems();
  const boxes = [];
  for (let i = 0; i < els.length; i++) {
    const relevantAnnotation = getAnnotationById(
      annotations,
      els[i].node.dataset.id
    );
    relevantAnnotation.boundingBox.top = relevantAnnotation.boundingBox[0].y;
    relevantAnnotation.boundingBox.height =
      relevantAnnotation.boundingBox[2].y - relevantAnnotation.boundingBox[0].y;
    relevantAnnotation.boundingBox.left = relevantAnnotation.boundingBox[0].x;
    relevantAnnotation.boundingBox.bottom = relevantAnnotation.boundingBox[2].y;
    relevantAnnotation.boundingBox.right = relevantAnnotation.boundingBox[1].x;
    let elDict = {
      boundingBox: relevantAnnotation.boundingBox,
      text: els[i].node.textContent,
      break: relevantAnnotation.break,
      //The font size of the text based on the height of the bounding box
      fontSize:
        relevantAnnotation.boundingBox[2].y -
        relevantAnnotation.boundingBox[0].y,
      id: relevantAnnotation.id,
      blockId: relevantAnnotation.blockId,
    };

    boxes.push(elDict);
  }
  return boxes;
}

function getClosestBoxToOrigin(boxes) {
  let minTop = Infinity;
  let closestBox = null;
  let boxIndex = null;
  for (let i = 0; i < boxes.length; i++) {
    let box = boxes[i];
    let top = box.boundingBox.top;
    if (top < minTop) {
      minTop = top;
      closestBox = box;
      boxIndex = i;
    }
  }
  boxes.splice(boxIndex, 1);
  return closestBox;
}

function getAllBoxesOnSameLine(boxes, box) {
  let boxesOnSameLine = [box];
  let middleFifth = {
    top: box.boundingBox.top + 2 * (box.boundingBox.height / 5),
    bottom: box.boundingBox.top + 3 * (box.boundingBox.height / 5),
  };
  for (let i = boxes.length - 1; i >= 0; i--) {
    let otherBox = boxes[i];
    // If otherbox overlaps vertically with the middle fifth
    if (
      (otherBox.boundingBox.top < middleFifth.bottom &&
        otherBox.boundingBox.bottom > middleFifth.top) ||
      (otherBox.boundingBox.top > middleFifth.top &&
        otherBox.boundingBox.bottom < middleFifth.bottom)
    ) {
      boxesOnSameLine.push(otherBox);
      boxes.splice(i, 1);
    }
  }
  return boxesOnSameLine;
}

function sortBoxesOnSameLine(boxesOnSameLine) {
  return boxesOnSameLine.sort((a, b) => {
    return a.boundingBox.left - b.boundingBox.left;
  });
}

function getTextStringFromSortedLineOfBoxes(sortedBoxesOnSameLine, copyMode) {
  let text = "";
  for (let i = 0; i < sortedBoxesOnSameLine.length; i++) {
    let box = sortedBoxesOnSameLine[i];
    text += box.text;
    if (i < sortedBoxesOnSameLine.length - 1) {
      // We detect newlines as OCR API is unreliable so treat a detected newline as a space.
      if (box.break === "\n") {
        text += " ";
      } else {
        text += box.break;
      }
    } else {
      if (copyMode === "singleline") {
        text += " ";
      } else {
        text += "\n";
      }
    }
  }
  return text;
}

function sumBoxIds(boxes) {
  return boxes.reduce((sum, box) => {
    return sum + box.id;
  }, 0);
}

function splitLineOfBoxesIntoBlocks(lineOfBoxes) {
  const boxesByBlock = {};
  for (const box of lineOfBoxes) {
    if (boxesByBlock[box.blockId] === undefined) {
      boxesByBlock[box.blockId] = [box];
    } else {
      boxesByBlock[box.blockId].push(box);
    }
  }
  return Object.values(boxesByBlock);
}

function isDetectedAsLeftToRight(linesOfBoxes) {
  let leftToRightTotal = 0;
  for (const lineOfBoxes of linesOfBoxes) {
    if (lineOfBoxes.length <= 1) {
      continue;
    }

    const linesOfBoxesByBlock = splitLineOfBoxesIntoBlocks(lineOfBoxes);

    for (const lineOfBoxesByBlock of linesOfBoxesByBlock) {
      if (lineOfBoxesByBlock.length <= 1) {
        continue;
      }

      const middleIndex = Math.floor(lineOfBoxesByBlock.length / 2);

      const firstHalf = lineOfBoxesByBlock.slice(0, middleIndex);
      const secondHalf = lineOfBoxesByBlock.slice(-middleIndex);

      const sumOfIdsFirstHalf = sumBoxIds(firstHalf);
      const sumOfIdsSecondHalf = sumBoxIds(secondHalf);

      if (sumOfIdsFirstHalf <= sumOfIdsSecondHalf) {
        leftToRightTotal += lineOfBoxesByBlock.length;
      } else {
        leftToRightTotal -= lineOfBoxesByBlock.length;
      }
    }
  }

  return leftToRightTotal >= 0;
}

async function generateFinalCopiedText(selectable, annotations) {
  let copyMode = await settingsManager.get("copyMode");
  let boxes = getAllSelectedBoxes(selectable, annotations);
  let linesOfBoxes = [];
  while (boxes.length > 0) {
    let closestBox = getClosestBoxToOrigin(boxes);
    let boxesOnSameLine = getAllBoxesOnSameLine(boxes, closestBox);
    let sortedBoxesOnSameLine = sortBoxesOnSameLine(boxesOnSameLine);
    linesOfBoxes.push(sortedBoxesOnSameLine);
  }

  let result = "";
  const isLeftToRight = isDetectedAsLeftToRight(linesOfBoxes);

  if (isLeftToRight === true && copyMode === "indentation") {
    result += generateIndentedText(linesOfBoxes, copyMode);
  } else {
    for (const lineOfBoxes of linesOfBoxes) {
      if (isLeftToRight === false) {
        lineOfBoxes.reverse();
      }

      result += getTextStringFromSortedLineOfBoxes(lineOfBoxes, copyMode);
    }
  }

  // Remove space or newline character at the end
  return result.slice(0, -1);
}

function getAverageFontSizeOfBoxes(linesOfBoxes) {
  let numberOfBoxes = 0;
  let sumOfFontSize = 0;
  for (const line of linesOfBoxes) {
    for (const box of line) {
      numberOfBoxes++;
      sumOfFontSize += box.fontSize;
    }
  }
  if (numberOfBoxes > 0) {
    return sumOfFontSize / numberOfBoxes;
  }
  return null;
}

function getObservedSpaceCharWidth(
  leftMostBox,
  widthOfSpaceChar,
  linesOfBoxes
) {
  let minNumberOfSpaces;
  let minNumberOfSpacesObservedSpaceWidths;

  for (const line of linesOfBoxes) {
    let distanceBetweenLeftMostBox =
      line[0].boundingBox.left - leftMostBox.boundingBox.left;
    let unroundedNumberOfSpaces;

    if (widthOfSpaceChar === null) {
      unroundedNumberOfSpaces = 0;
    } else {
      unroundedNumberOfSpaces = distanceBetweenLeftMostBox / widthOfSpaceChar;
    }

    // Round to nearest multiple of 2
    let numberOfSpaces = Math.round(unroundedNumberOfSpaces / 2) * 2;

    if (numberOfSpaces > 0) {
      if (
        minNumberOfSpaces === undefined ||
        numberOfSpaces < minNumberOfSpaces
      ) {
        minNumberOfSpaces = numberOfSpaces;
        minNumberOfSpacesObservedSpaceWidths = [
          distanceBetweenLeftMostBox / numberOfSpaces,
        ];
      } else if (numberOfSpaces === minNumberOfSpaces) {
        minNumberOfSpacesObservedSpaceWidths.push(
          distanceBetweenLeftMostBox / numberOfSpaces
        );
      }
    }
  }

  if (minNumberOfSpaces === undefined) {
    return widthOfSpaceChar;
  } else {
    return (
      minNumberOfSpacesObservedSpaceWidths.reduce((a, b) => a + b, 0) /
      minNumberOfSpacesObservedSpaceWidths.length
    );
  }
}

function generateIndentedText(linesOfBoxes, copyMode) {
  let leftMostBox = getLeftMostBoxFromLinesOfBoxes(linesOfBoxes);
  const averageFontSize = getAverageFontSizeOfBoxes(linesOfBoxes);
  let widthOfSpaceChar = null;
  if (averageFontSize !== null) {
    widthOfSpaceChar = getTextWidth(" ", `${averageFontSize}px monospace`);
  }

  const observedWidthofSpaceChar = getObservedSpaceCharWidth(
    leftMostBox,
    widthOfSpaceChar,
    linesOfBoxes
  );

  let result = "";
  for (const line of linesOfBoxes) {
    let distanceBetweenLeftMostBox =
      line[0].boundingBox.left - leftMostBox.boundingBox.left;
    let unroundedNumberOfSpaces;
    if (observedWidthofSpaceChar === null) {
      unroundedNumberOfSpaces = 0;
    } else {
      unroundedNumberOfSpaces =
        distanceBetweenLeftMostBox / observedWidthofSpaceChar;
    }

    // Round to nearest multiple of 2
    let numberOfSpaces = Math.round(unroundedNumberOfSpaces / 2) * 2;
    let lineOfText =
      " ".repeat(numberOfSpaces) +
      getTextStringFromSortedLineOfBoxes(line, copyMode);
    result += lineOfText;
  }
  return result;
}

function getTextWidth(text, font) {
  // re-use canvas object for better performance
  const canvas =
    getTextWidth.canvas ||
    (getTextWidth.canvas = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}

function getLeftMostBoxFromLinesOfBoxes(linesOfBoxes) {
  let leftMostBox;
  for (const line of linesOfBoxes) {
    const leftMostBoxOnLine = line[0];
    if (
      leftMostBox === undefined ||
      leftMostBoxOnLine.boundingBox.left < leftMostBox.boundingBox.left
    ) {
      leftMostBox = leftMostBoxOnLine;
    }
  }
  return leftMostBox;
}

async function processSelectedWords(
  selectable,
  videoOverlay,
  video,
  annotations
) {
  let result = await generateFinalCopiedText(selectable, annotations);

  if (result !== "") {
    copyToClipboard(result);
    showFadingMessage(
      " Text copied",
      2000,
      false,
      "images/copy.svg",
      videoOverlay,
      video
    );

    if (
      currentSelectionInfo !== undefined &&
      currentSelectionInfo.selections !== undefined
    ) {
      currentSelectionInfo.selections.push(result);
    }
  }
}

/**
 * Copies text to clipboard by creating a temporary hidden textArea
 * @param {string} result the text to be copied.
 */
function copyToClipboard(result) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(result).then(
      () => {},
      (err) => copyToClipboardLegacy(result)
    );
  } else {
    copyToClipboardLegacy(result);
  }
}

function copyToClipboardLegacy(result) {
  if (!inIframe()) {
    var $temp = $("<textarea>");
    $("body").append($temp);
    $temp.val(result).select();
    document.execCommand("copy");
    $temp.remove();
  } else {
    // Send message to parent frame with result
    window.parent.postMessage(
      {
        type: "SELECTEXT_IFRAME_COPY",
        text: result,
      },
      "*"
    );
  }
}

/**
 * Show a fading alert message near the top of the Youtube video.
 * @param {string} text the text to be shown in the message
 * @param {int} milliseconds the number of milliseconds before the message fades out.
 * @param {boolean} comesBack whether the message shows again when the toggle is switched off and on
 * @param {string} iconPath the path to the icon image file to show on the left of the message
 */
async function showFadingMessage(
  text,
  milliseconds,
  comesBack,
  iconPath,
  videoOverlay,
  video
) {
  await new Promise((resolve) => {
    queryShadowRoot(".alertMessage", true, videoOverlay).remove();

    if (videoOverlay.id !== "messageOverlay") {
      getMessageShadowHostForVideo(video).remove();
    }

    let $message = $(document.createElement("div"));
    $message.addClass("alertMessage");
    $message.click((event) => event.stopPropagation());

    let top;
    if (videoIsFullscreen(video)) {
      top = 70;
    } else {
      top = 20;
    }

    // If the overlay is off the screen
    const overlayRect = videoOverlay.getBoundingClientRect();
    if (overlayRect.y < 0) {
      top -= overlayRect.y;
    }

    $message.css("top", `${top}px`);

    if (iconPath) {
      let imgURL = browser.runtime.getURL(iconPath);
      let $icon = $(document.createElement("img"))
        .attr("src", imgURL)
        .css("display", "inline-block");

      $icon
        .css("width", "20px")
        .css("height", "20px")
        .css("vertical-align", "middle");
      $message.append($icon);
    }

    const fadingMessageText = document.createElement("div");
    fadingMessageText.className = "fadingMessageText";

    let textNode = document.createTextNode(text);
    fadingMessageText.appendChild(textNode);

    const $fadingMessageText = $(fadingMessageText);
    $message.append($fadingMessageText);
    $(videoOverlay).append($message);

    if (comesBack) {
      $message.attr("id", "persistentMessage");
    }
    setTimeout(() => {
      if (comesBack) {
        $message.fadeOut(resolve);
      } else {
        $message.fadeOut(() => {
          $message.remove();
          resolve();
        });
      }
    }, milliseconds);
  });
}

function getResizeObserverForVideo(video) {
  const resizeObserverInfo = resizeObserverMap.get(video);
  if (resizeObserverInfo !== undefined) {
    return resizeObserverInfo.observer;
  }
  return undefined;
}

/**
 * Add a resize observer that watches for a change in video size to resize the video overlay and optionally redraw the
 * text.
 * @param {Element} video the HTML video element.
 * @param {Element} videoOverlay the HTML video ovrlay element.
 * @param {Array} textAnnotations the array of JSON object representing the text nodes in the format returned by
 */
function addResizeObserver(
  video,
  videoOverlay,
  textAnnotations,
  videoPosition,
  initialScaleFactor
) {
  const resizeObserver = getResizeObserverForVideo(video);
  if (resizeObserver !== undefined) {
    resizeObserver.disconnect();
  }

  let newResizeObserver;
  // If we have some detected text, redraw it as well as resizing the overlay
  newResizeObserver = new ResizeObserver(() => {
    const thisResizeObserverInfo = resizeObserverMap.get(video);
    const newFiredCount = thisResizeObserverInfo.firedCount + 1;
    resizeObserverMap.set(video, {
      observer: thisResizeObserverInfo.observer,
      firedCount: thisResizeObserverInfo.firedCount + 1,
    });
    if (newFiredCount === 1) {
      return;
    }
    videoOverlay.style.display = "none";
    if (textAnnotations) {
      let textWrapper = queryShadowRoot("#textWrapper", false, videoOverlay);
      if (textWrapper !== null) {
        textWrapper.remove();
      }
    }
    setTimeout(() => {
      const resizeObserverInfoAfterTimeout = resizeObserverMap.get(video);
      if (resizeObserverInfoAfterTimeout === undefined) {
        return;
      }
      if (resizeObserverInfoAfterTimeout.firedCount !== newFiredCount) {
        return;
      }

      if (videoIsValid(video)) {
        videoOverlay.style.removeProperty("display");
        resizeVideoOverlay(video, videoOverlay);
        if (textAnnotations) {
          drawText(
            video,
            videoOverlay,
            textAnnotations,
            videoPosition,
            initialScaleFactor
          );
        }
      }
    }, 1000);
  });
  resizeObserverMap.set(video, { observer: newResizeObserver, firedCount: 0 });
  newResizeObserver.observe(video);
}

/**
 * Resize the video overlay to match the size of the video
 * @param {Element} video the HTML video element.
 * @param {Element} videoOverlay the HTML video overlay element.
 */
function resizeVideoOverlay(video, videoOverlay, size = true) {
  const $video = $(video);

  if (size === true) {
    videoOverlay.style.width = `${$video.width()}px`;
    videoOverlay.style.height = `${$video.height()}px`;
  }

  const siteName = getSiteNameFromURL(window.location.href);
  // On datacamp they have some weird overlay with z-index 1
  if (siteName.endsWith("datacamp.com")) {
    videoOverlay.style.zIndex = 1;
  } else {
    videoOverlay.style.zIndex = $video.css("z-index");
  }

  videoOverlay.style.position = "absolute";

  $(videoOverlay).position({
    my: "left top",
    at: "left top",
    of: $video,
  });

  adjustTogglePos(undefined, video, videoOverlay);
}

/**
 * An interaction with JQuery selectable and the UoA video players made the video resume when dragging into the bottom
 * bar of the video. Apply a hack to catch the click event.
 * @param {Element} textWrapper the text wrapper HTML element.
 */
function stopDragSelectResumingVideo(textWrapper, selectable) {
  textWrapper.addEventListener("mousedown", () => {
    //Hack to stop video resuming when drag select drags into bottom bar
    window.addEventListener("click", stopProp, {
      capture: true,
      once: true,
    });

    const mouseupHandler = (e) => {
      // Will be undefined for iframe way
      if (e.stopPropagation !== undefined) {
        e.stopPropagation();
      }
      selectable._end(e);
      setTimeout(
        () =>
          window.removeEventListener("click", stopProp, {
            capture: true,
            once: true,
          }),
        20
      );
    };

    // When using iframe the mouseup outside iframe is not detected to end the selection so need to use postmessage
    // For whatever reason it is fine in firefox but not in chrome
    if (!inIframe() || BROWSER_TYPE === "firefox") {
      window.addEventListener("mouseup", mouseupHandler, {
        capture: true,
        once: true,
      });
    } else {
      // Send message to parent page to attach event listener
      window.parent.postMessage(
        {
          type: "SELECTEXT_IFRAME_ATTACH_MOUSEUP_HANDLER",
          iframeSrc: window.location.href,
        },
        "*"
      );
      // Handle response from parent page
      const handleMessage = (e) => {
        if (
          e.data.type === "SELECTEXT_IFRAME_MOUSEUP_HANDLER_FIRED" &&
          e.data.event !== undefined
        ) {
          mouseupHandler(e.data.event);
          window.removeEventListener("mouseup", mouseupHandler, {
            capture: true,
            once: true,
          });
        } else {
          window.addEventListener("message", handleMessage, { once: true });
        }
      };
      window.addEventListener("message", handleMessage, { once: true });

      selectable.on("end", (e, selected, unselected) => {
        setTimeout(
          () =>
            window.removeEventListener("message", handleMessage, {
              once: true,
            }),
          100
        );
      });

      // Note: ideally we clean up mouseup click blocker on parent page here but not worth it
      window.addEventListener("mouseup", mouseupHandler, {
        capture: true,
        once: true,
      });
    }
  });
}

function stopProp(e) {
  e.stopPropagation();
}

/**
 * Remove existing generated text and reset the toggle to false when we scrub the video
 * @param {Element} video the HTML video element.
 * @param {Element} toggle the HTML input element in the toggle.
 */
function onScrubWhilePaused(video, videoOverlay) {
  if (video.paused) {
    $(videoOverlay).data("activated", false);

    const textWrapper = queryShadowRoot("#textWrapper", false, videoOverlay);

    if (textWrapper !== null) {
      textWrapper.remove();
      sendAndResetCurrentSelectionInfo();
    }

    const loader = queryShadowRoot("#selecTextLoader", false, videoOverlay);
    if (loader !== null) {
      loader.remove();
    }

    const comesBackMsg = queryShadowRoot(
      "#persistentMessage",
      false,
      videoOverlay
    );
    if (comesBackMsg !== null) {
      comesBackMsg.remove();
    }

    const toggle = queryShadowRoot("#selecTextToggle", false, videoOverlay);
    if (toggle !== null) {
      toggle.checked = false;
    }

    const loginWrapper = queryShadowRoot(
      ".selectextLoginWrapper",
      false,
      videoOverlay
    );
    if (loginWrapper !== null) {
      loginWrapper.remove();
    }
  }
}

/**
 * Move the toggle down on fullscreen so the video header isnt blocking it.
 * @param {HTMLElement} toggle optionally the corner wrapper html Element
 */
function adjustTogglePos(toggle, video, videoOverlay) {
  if (toggle === undefined) {
    toggle = queryShadowRoot("#cornerWrapper", false, videoOverlay);
  }
  if (toggle !== null && toggle !== undefined) {
    toggle.style.top = `${getToggleTop(video)}px`;
    toggle.style.left = "10px";
  }

  const screenshotButton = queryShadowRoot(
    "#screenshotButton",
    false,
    videoOverlay
  );
  if (screenshotButton !== null) {
    let screenshotTop;
    if (toggle !== null) {
      screenshotTop = getToggleTop(video, 40);
    } else {
      screenshotTop = getToggleTop(video, 0);
    }
    screenshotButton.style.top = `${screenshotTop}px`;
    screenshotButton.style.left = "10px";
  }
}

function getToggleTop(video, add = 0) {
  let top;
  if (videoIsFullscreen(video) || inIframe()) {
    top = 100;
  } else {
    top = 10;
  }

  // If the overlay is off the screen
  const overlayRect = video.getBoundingClientRect();

  if (overlayRect.y < 0 && overlayRect.bottom > 0) {
    top -= overlayRect.y;
  }
  return top + add;
}

/**
 * @returns {boolean} whether the video is fullscreen
 */
function videoIsFullscreen(video) {
  const windowIsFullscreen =
    (screen.availHeight || screen.height - 30) <= window.innerHeight;
  const videoCoversMostOfScreenHeight =
    $(video).height() > document.documentElement.clientHeight - 100;
  return windowIsFullscreen || videoCoversMostOfScreenHeight;
}

/**
 * Initialise the current selection info object
 */
function initCurrentSelectionInfo(timeOfButtonPress, detectedLanguages) {
  currentSelectionInfo = {
    URL: window.location.href,
    selections: [],
    timeOfButtonPress: timeOfButtonPress,
    browser: BROWSER_TYPE,
    detectedLanguages: detectedLanguages,
    version: browser.runtime.getManifest().version,
  };
}

/**
 * Send the current selection info to the background script to be logged via the selectext API
 */
function sendAndResetCurrentSelectionInfo() {
  if (currentSelectionInfo !== undefined) {
    browser.runtime.sendMessage({
      currentSelectionInfo: currentSelectionInfo,
    });
  }

  currentSelectionInfo = undefined;
}

function setTextDisplay(value) {
  const allVideoOverlays = queryShadowRoot("#videoOverlay");

  if (value === "transparent") {
    allVideoOverlays.addClass("transparent");
  } else if (value === "boxes") {
    allVideoOverlays.removeClass("transparent");
  }
}

function onPauseFromPopup() {
  // Remove existing overlays
  $(".selectextShadowHost").remove();

  // Remove event listeners
  let videos = document.getElementsByTagName("video");
  for (let i = 0; i < videos.length; i++) {
    removeVideoEventListeners(videos[i]);
  }

  // Unbind arrive
  Arrive.unbindAllArrive();

  // Disconnect all resize observers
  for (let resizeObserverInfo of resizeObserverMap.values()) {
    resizeObserverInfo.observer.disconnect();
  }
  resizeObserverMap.clear();
  videoToVideoOverlayMap.clear();
}

function onResumeFromPopup() {
  findVideo(true);
}

async function cropPageDataUriToVideoFrameCanvas(
  videoPosition,
  viewportDimensions,
  pageDataUri
) {
  return new Promise((resolutionFunc, rejectionFunc) => {
    // Create off screen image with dataURL as source
    var img = new Image();

    img.onload = () => {
      // create an off-screen canvas
      var canvas = document.createElement("canvas");

      // The relative size of the window vs the screenshot to fe the cropping dimensions
      const resolutionScaleFactor = img.width / viewportDimensions.width;
      const resolutionScaleFactorY = resolutionScaleFactor;

      const width = videoPosition.width * resolutionScaleFactor;
      const height = videoPosition.height * resolutionScaleFactorY;

      const topOffset = videoPosition.top * resolutionScaleFactorY;
      const leftOffset = videoPosition.left * resolutionScaleFactor;

      const inputScaleFactor = getImageScaleFactor(
        MAX_VIDEO_FRAME_WIDTH,
        width
      );

      const finalWidth = width * inputScaleFactor;
      const finalHeight = height * inputScaleFactor;

      canvas.width = finalWidth;
      canvas.height = finalHeight;

      // draw video frame into the off-screen canvas
      canvas
        .getContext("2d")
        .drawImage(
          img,
          leftOffset,
          topOffset,
          width,
          height,
          0,
          0,
          finalWidth,
          finalHeight
        );

      resolutionFunc({
        canvas: canvas,
        outputScaleFactor: 1 / (inputScaleFactor * resolutionScaleFactor),
      });
    };

    img.src = pageDataUri;
  });
}

/**
 * Show the popup over the video that prompts the user to sign in
 */
function showLoginPopup(videoOverlay, video) {
  if (
    queryShadowRoot(".selectextLoginWrapper", true, videoOverlay).length > 0
  ) {
    return;
  }
  const loginPage = browser.runtime.getURL("login.html");

  const $loginWrapper = $('<div class="selectextLoginWrapper"></div>');

  $loginWrapper
    .appendTo($(videoOverlay))
    .load(loginPage, () => onLoginLoaded(videoOverlay));

  $loginWrapper.click((e) => e.stopPropagation());
  $loginWrapper.mousedown((e) => e.stopPropagation());
  $loginWrapper.mouseup((e) => e.stopPropagation());

  queryShadowRoot("#selecTextLoader", true, videoOverlay).remove();

  setTimeout(
    () => loginWrapperDiamondDrill($loginWrapper, video, videoOverlay),
    200
  );
}

function showReviewPopup(videoOverlay, video) {
  if (
    queryShadowRoot(".selectextReviewWrapper", true, videoOverlay).length > 0
  ) {
    return;
  }

  const reviewPage = browser.runtime.getURL("review.html");

  const $reviewWrapper = $('<div class="selectextReviewWrapper"></div>');

  $reviewWrapper
    .appendTo($(videoOverlay))
    .load(reviewPage, () => onReviewLoaded(videoOverlay));

  $reviewWrapper.click((e) => e.stopPropagation());
  $reviewWrapper.mousedown((e) => e.stopPropagation());
  $reviewWrapper.mouseup((e) => e.stopPropagation());

  setTimeout(
    () => reviewWrapperDiamondDrill($reviewWrapper, video, videoOverlay),
    200
  );
}

function reviewWrapperDiamondDrill(reviewWrapper, video, videoOverlay) {
  const leaveReviewButton = reviewWrapper.find(".leaveReviewButton").get(0);
  const noThanksButton = reviewWrapper.find(".noThanksButton").get(0);

  if (leaveReviewButton !== undefined) {
    ensureTextWrapperIsClickable(leaveReviewButton, video, videoOverlay);
  }

  if (noThanksButton !== undefined) {
    ensureTextWrapperIsClickable(noThanksButton, video, videoOverlay);
  }
}

function loginWrapperDiamondDrill(loginWrapper, video, videoOverlay) {
  const loginButton = loginWrapper
    .find(".selectextLoginWithGoogleButton")
    .get(0);

  if (loginButton !== undefined) {
    ensureTextWrapperIsClickable(loginButton, video, videoOverlay);
  }
}

/**
 * Add the loading spinner to the videoOverlay
 * @returns The spinner HTML element
 */
function addSpinner(videoOverlay) {
  //Add a loading spinner to the center of the overlay
  spinner = $("<div id='selecTextLoader'></div>").appendTo($(videoOverlay));
  return spinner;
}

/**
 * Detect if we are currently running in an iFrame
 * @returns true if in iframe, otherwise false
 */
function inIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

async function getTopLevelDomain() {
  if (!inIframe()) {
    return getSiteNameFromURL(window.location.href);
  } else {
    let url = await getURLofParentPage();

    if (url === null) {
      return false;
    }
    return getSiteNameFromURL(url);
  }
}

function getURLofParentPage() {
  return new Promise((resolutionFunc, rejectionFunc) => {
    let onIframeURLResponse = (e) => {
      if (e.data.type == "SELECTEXT_URL_RESPONSE") {
        resolutionFunc(e.data.url);
        window.removeEventListener("message", onIframeURLResponse);
      }
    };
    setTimeout(() => {
      window.addEventListener("message", onIframeURLResponse);

      window.top.postMessage(
        {
          type: "SELECTEXT_IFRAME_URL_REQUEST",
          iframeSrc: window.location.href,
        },
        "*"
      );

      setTimeout(() => {
        window.removeEventListener("message", onIframeURLResponse);
        resolutionFunc(null);
      }, 500);
    }, 500);
  });
}
