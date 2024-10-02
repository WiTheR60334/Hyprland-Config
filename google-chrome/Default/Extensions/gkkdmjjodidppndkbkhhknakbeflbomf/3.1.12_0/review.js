function onReviewLoaded(videoOverlay) {
    setTimeout(() => {
        queryShadowRoot(".selectextReviewLogo", true, videoOverlay).attr("src", browser.runtime.getURL("images/selectext-logo-filled.svg"));
        const leaveReviewButton = queryShadowRoot(".leaveReviewButton", true, videoOverlay);
        const noThanksButton = queryShadowRoot(".noThanksButton", true, videoOverlay);

        leaveReviewButton.click((e) => leaveReviewButtonClick(e, videoOverlay));
        noThanksButton.click((e) => noThanksButtonClick(e, videoOverlay));

        leaveReviewButton.on("mouseup", (e) => e.stopPropagation());
        leaveReviewButton.on("mousedown", (e) => e.stopPropagation());

        noThanksButton.on("mouseup", (e) => e.stopPropagation());
        noThanksButton.on("mousedown", (e) => e.stopPropagation());
    }, 50)
}

function leaveReviewButtonClick(e, videoOverlay) {
    e.stopPropagation()
    browser.runtime.sendMessage({leaveReviewClicked: true})
    queryShadowRoot(".selectextReviewWrapper", true, videoOverlay).remove();
    queryShadowRoot("#textWrapper", true, videoOverlay).css("visibility", "");
}

function noThanksButtonClick(e, videoOverlay) {
    e.stopPropagation()
    queryShadowRoot(".selectextReviewWrapper", true, videoOverlay).remove();
    queryShadowRoot("#textWrapper", true, videoOverlay).css("visibility", "");
}