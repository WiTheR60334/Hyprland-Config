function getBoundingClientRectWithinWindow(video) {
    // Need this because if the video is in an iframe, 
    // it could be overflowing outside the iframe bounds which we should not count as screen area
    // May as well still run for top level page as well

    const boundingClientRect = video.getBoundingClientRect();

    return {
        left: Math.max(0, boundingClientRect.left),
        right: Math.min(window.innerWidth, boundingClientRect.right),
        top: Math.max(0, boundingClientRect.top),
        bottom: Math.min(window.innerHeight, boundingClientRect.bottom)
    }
}


function getScreenAreaFromBoundingRect(boundingClientRect, windowWidth = null, windowHeight = null, offsetX = 0, offsetY = 0) {
    if (windowWidth === null) {
        windowWidth = window.innerWidth;
    }

    if (windowHeight === null) {
        windowHeight = window.innerHeight;
    }

    boundingClientRect.left += offsetX;
    boundingClientRect.right += offsetX;
    boundingClientRect.top += offsetY;
    boundingClientRect.bottom += offsetY;

    const windowRect = {left: 0, right: windowWidth, top: 0, bottom: windowHeight};

    const x_overlap = Math.max(0, Math.min(boundingClientRect.right, windowRect.right) - Math.max(boundingClientRect.left, windowRect.left));
    const y_overlap = Math.max(0, Math.min(boundingClientRect.bottom, windowRect.bottom) - Math.max(boundingClientRect.top, windowRect.top));

    return x_overlap * y_overlap;
}


function findBiggestScreenAreaVideoOnPage(windowWidth = null, windowHeight = null, offsetX = 0, offsetY = 0) {
    const videosOnPage = document.getElementsByTagName("video");

    let largestArea = 0;
    let largestVideo = null;

    for (const video of videosOnPage) {
        if (!videoIsValid()) {
            return;
        }

        const boundingClientRect = getBoundingClientRectWithinWindow(video);

        const videoScreenArea = getScreenAreaFromBoundingRect(boundingClientRect, windowWidth, windowHeight, offsetX, offsetY);

        if (videoScreenArea > largestArea) {
            largestArea = videoScreenArea;
            largestVideo = video;
        }
    }

    return {
        screenArea: largestArea,
        video: largestVideo
    }
}

async function findBiggestVideosWithinIframes() {
    // For each iframe, get biggest screen area num using messaging
    // Iframe waits to hear whether it is the biggest video
    const allIframes = document.getElementsByTagName("iframe");
    
    const iframeVideoSearchPromises = [];
    for (var i = 0; i < allIframes.length; i++) {
        const iframe = allIframes[i];
        const index = i;

        const iframeVideoSearchPromise = new Promise((resolve, reject) => {
            const iframeMaxVideoSizeListener = (event) => {
                if (!event.data || event.data.type !== "MAX_SCREEN_AREA_VIDEO_RESPONSE" || event.data.index !== index) {
                    return;
                }

                window.removeEventListener("message", iframeMaxVideoSizeListener)

                const maxVideoScreenArea = event.data.maxVideoScreenArea;
                resolve({iframe: iframe, screenArea: maxVideoScreenArea})
            }

            window.addEventListener("message", iframeMaxVideoSizeListener);

            const iframeBoundingRect = iframe.getBoundingClientRect();
            iframe.contentWindow.postMessage({
                type: "MAX_SCREEN_AREA_VIDEO_REQUEST",
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                offsetX: iframeBoundingRect.left,
                offsetY: iframeBoundingRect.top,
                index: index
            }, "*")

            setTimeout(() => {
                reject("Iframe did not return max video screen area in time")
            }, 100)
        });
        iframeVideoSearchPromises.push(iframeVideoSearchPromise)
    }

    const settledIframeVideoSearchPromises = await Promise.allSettled(iframeVideoSearchPromises);
    const fulfilledPromises = [];
    for (const settledIframeVideoSearchPromise of settledIframeVideoSearchPromises) {
        if (settledIframeVideoSearchPromise.status === "fulfilled" && settledIframeVideoSearchPromise.value.screenArea > 0) {
            fulfilledPromises.push(settledIframeVideoSearchPromise.value);
        }
    }
    return fulfilledPromises;
}


function pauseVideoAndWaitForOnPause(video) {
    return new Promise((resolve) => {
        const onPauseListener = () => {
            video.removeEventListener("pause", onPauseListener);
            resolve()
        }
        video.addEventListener("pause", onPauseListener)
        video.pause();
    })
}


async function activateSelectextViaKeyboard(video) {
    if (!video.paused) {
        video.removeEventListener("pause", onVideoPauseWrapper);
        await pauseVideoAndWaitForOnPause(video)
        await onVideoPause(video)
        video.addEventListener("pause", onVideoPauseWrapper);
        activateSelectextForVideo(video);
    } else {
        const videoOverlay = getVideoOverlayForVideo(video);
        if (videoOverlay === undefined) {
            await onVideoPause(video);
        }
        activateSelectextForVideo(video);
    }
}

function activateSelectextForVideo(video) {
    const videoOverlay = getVideoOverlayForVideo(video);
    if (videoOverlay === undefined) {
        return;
    }
    
    programmaticallyClickToggle(video, videoOverlay);
}

async function findBiggestScreenAreaVideoOrIframe() {
    // Find biggest screen area video on page
    const biggestScreenAreaVideoInfo = findBiggestScreenAreaVideoOnPage();

    const iframeBiggestVideoSizes = await findBiggestVideosWithinIframes();

    let largestVideoIframe = null;
    let maxVideoScreenArea = biggestScreenAreaVideoInfo.screenArea;

    for (const iframeVideoSize of iframeBiggestVideoSizes) {
        if (iframeVideoSize.screenArea > maxVideoScreenArea) {
            largestVideoIframe = iframeVideoSize.iframe;
            maxVideoScreenArea = iframeVideoSize.screenArea;
        }
    }
    
    if (maxVideoScreenArea === 0) {
        return null;
    }

    if (largestVideoIframe !== null) {
        return { "iframe": largestVideoIframe }
    } else {
        return { "video": biggestScreenAreaVideoInfo.video }
    }
}

if (!inIframe()) {
    browser.runtime.onMessage.addListener(async (request) => {
        if (request.type !== undefined && request.type === "COPY_TEXT_FROM_VIDEO_SHORTCUT") {
            if (await settingsManager.isSelectextEnabled() && await settingsManager.get("copyTextKeyboardShortcutChecked")) {
                keyboardShortcutPressed();
            }
        }
    })

    

    async function keyboardShortcutPressed() {
        const videoOrIframe = await findBiggestScreenAreaVideoOrIframe();

        if (videoOrIframe === null) {
            return;
        }
    
        if (videoOrIframe.video !== undefined) {
            activateSelectextViaKeyboard(videoOrIframe.video)
        } else {
            const largestVideoIframeBoundingRect = videoOrIframe.iframe.getBoundingClientRect();
            videoOrIframe.iframe.contentWindow.postMessage({
                type: "IFRAME_HAS_LARGEST_VIDEO",
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                offsetX: largestVideoIframeBoundingRect.left,
                offsetY: largestVideoIframeBoundingRect.top
            }, "*")
        }
    }
} else {
    function maxScreenAreaVideoRequestHandler(windowWidth, windowHeight, offsetX, offsetY, index) {
        const biggestScreenAreaVideoInfo = findBiggestScreenAreaVideoOnPage(windowWidth, windowHeight, offsetX, offsetY);
        window.top.postMessage({
            type: "MAX_SCREEN_AREA_VIDEO_RESPONSE",
            maxVideoScreenArea: biggestScreenAreaVideoInfo.screenArea,
            index: index
        }, "*")
    }
    
    
    function iframeHasLargestVideoHandler(windowWidth, windowHeight, offsetX, offsetY) {
        const biggestScreenAreaVideoInfo = findBiggestScreenAreaVideoOnPage(windowWidth, windowHeight, offsetX, offsetY);
        if (biggestScreenAreaVideoInfo.video === null) {
            return null;
        }
        activateSelectextViaKeyboard(biggestScreenAreaVideoInfo.video);
    }

    window.addEventListener("message", function (event) {
        const eventData = event.data;
        if (eventData === undefined) {
            return;
        }

        const eventType = eventData.type;

        switch (eventType) {
            case "MAX_SCREEN_AREA_VIDEO_REQUEST":
                maxScreenAreaVideoRequestHandler(eventData.windowWidth, eventData.windowHeight, eventData.offsetX, eventData.offsetY, eventData.index);
                break;
            case "IFRAME_HAS_LARGEST_VIDEO":
                iframeHasLargestVideoHandler(eventData.windowWidth, eventData.windowHeight, eventData.offsetX, eventData.offsetY)
        }
    })
}
