function onLimitLoaded(videoOverlay, limit, planIsFree) {
    // Timeout as there is small lag in shadowDOM after load fired
    setTimeout(
        () => {
            queryShadowRoot(".selectextLimitLogo", true, videoOverlay).attr("src", browser.runtime.getURL("images/selectext-logo-filled.svg"))
            queryShadowRoot(".limitAmount", true, videoOverlay).text(limit)
            if (!planIsFree) {
                queryShadowRoot(".freeText", true, videoOverlay).text(" your")
                queryShadowRoot(".switchPlanText", true, videoOverlay).text("switch plan")
                queryShadowRoot(".switchPlanTextUpper", true, videoOverlay).text("Switch plan")
            }
            queryShadowRoot(".upgradeButton", true, videoOverlay).click(upgradeButtonClick)
        }, 50
    )
}


function upgradeButtonClick() {
    browser.runtime.sendMessage({ upgradeInNewTab: true })
}