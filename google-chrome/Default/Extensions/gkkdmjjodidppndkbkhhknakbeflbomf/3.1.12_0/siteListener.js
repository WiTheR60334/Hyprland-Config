/**
 * Listen for specific messages from the page (selectext.app)
 */
window.addEventListener("message", function(event) {
    // We only accept messages from ourselves
    if (event.source != window)
        return;

    const eventType = event.data.type;
    if (eventType) {
        if (eventType === "SELECTEXT_SIGN_IN_SUCCESS") {
            notifyBackgroundScriptOfSignInSuccess()
        } else if (eventType === "SELECTEXT_VIDEO_SCREENSHOT_UNLOCK") {
            unlockVideoScreenshot()
        }
    }
});


/**
 * Notify the background script that the sign in via the website was a success.
 */
function notifyBackgroundScriptOfSignInSuccess() {
    browser.runtime.sendMessage({loginComplete: true})
}

function unlockVideoScreenshot() {
    browser.runtime.sendMessage({ type: "is-screenshot-unlocked" });
}