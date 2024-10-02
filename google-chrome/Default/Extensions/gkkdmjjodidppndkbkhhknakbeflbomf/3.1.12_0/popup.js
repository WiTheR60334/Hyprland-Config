/**
 * Load Open Sans using JS for Chrome/Firefox compatibility
 */
loadCustomFonts();

var settingsManager;

/**
 * When the popup is opened
 **/
$(document).ready(async () => {
  let domain;
  try {
    domain = await getDomainForSite();
  } catch {
    domain = null;
  }
  settingsManager = initSettings(domain);

  initComponentsState(domain);
  addEventListenersToComponents();
  if (domain === null) {
    showCantRunHere();
  }

  initSettingsState();
  addSettingsEventListeners();
});

function showCantRunHere() {
  $(".selectextRunOnWrapper").remove();

  let selectextNotAvailable = $("<h3></h3>")
    .addClass("selectextSubHeader")
    .addClass("selectextIsNotAvailable")
    .text("Selectext is not available on this page");

  $(selectextNotAvailable).insertAfter(".selectextHeaderWrapper");
}

function getUserInfo() {
  const url = `${API_URL}/get-user-info`;
  return fetch(url, {
    method: "GET",
    mode: "cors",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
}

const generateResetsInText = (
  resetsInSeconds,
  isCancelled,
  isPaid,
  nextPlanInfo
) => {
  var d = Math.floor(resetsInSeconds / (3600 * 24));
  var h = Math.floor((resetsInSeconds % (3600 * 24)) / 3600);
  let firstWord = "Resets ";
  if (isCancelled) {
    firstWord = "Cancels ";
  } else if (isPaid) {
    firstWord = "Renews ";
  }

  if (nextPlanInfo !== undefined) {
    firstWord = `Dowgrades to '${nextPlanInfo.name}' plan`;
  }
  return `${firstWord} in ${d} day${d !== 1 ? "s" : ""}, ${h} hour${
    h !== 1 ? "s" : ""
  }`;
};

/**
 * Set the state of UI components based on browser storage values
 */
async function initComponentsState(domain) {
  browser.commands.getAll().then((commands) => {
    commands.forEach((command) => {
      if (command.name !== undefined) {
        const shortcut = command.shortcut !== "" ? command.shortcut : "Not set";
        if (command.name === "copy-text-from-video") {
          $(".copyTextShortcutDisplay").text(shortcut);
        } else if (command.name === "copy-video-screenshot") {
          $(".copyScreenshotShortcutDisplay").text(shortcut);
        }
      }
    });
  });

  getUserInfo()
    .then((response) => {
      if (response.status === 401) {
        $(".selectextPopupWrapper > :not(.selectextHeaderWrapper)").remove();
        $(".selectextPopupWrapper").append(
          "<p class='notSignedInText'>It looks like you haven't signed in yet</p>"
        );
        const tutorialButton = $(
          "<button class='selectextButton tutorialButton'>Follow the tutorial to get started</button>"
        );
        tutorialButton.click((e) => {
          browser.tabs.create({ url: `${WEBSITE_URL}/tutorial` });
        });
        $(".selectextPopupWrapper").append(tutorialButton);
        $(".selectextPopupWrapper").append(
          "<p class='notSignedInText' style='margin-bottom: 0px'>Or pause any video and click the toggle in the top left</p>"
        );
      } else {
        response.json().then((json) => {
          const picture = json.picture;
          if (picture) {
            $(".userIcon").attr("src", picture);
            $(".userIcon").css("border-radius", "50%");
          }

          const usage = json.usage;
          if (usage) {
            $(".dailyLimitText").text(usage.limit);
            $(".ocrCountText").text(usage.count);
            if (usage.limit === usage.count) {
              $(".usageText").css("color", "red");
            }
          }

          const plan = json.plan;
          if (plan) {
            if (plan.priceId === undefined) {
              $(".upgradeButton").text("Upgrade to get more credits");
              $(".upgradeButton").click(() =>
                browser.tabs.create({ url: `${WEBSITE_URL}/portal/plans` })
              );
            } else {
              $(".upgradeButton").text("Manage Subscription");
              $(".upgradeButton").click(() =>
                browser.tabs.create({ url: `${WEBSITE_URL}/portal/account` })
              );
            }

            const resetsInSeconds = json.plan.resetsInSeconds;
            const isCancelled = json.plan.isCancelled;
            const isPaid = json.plan.priceId !== undefined;
            const nextPlanInfo = json.plan.nextPlanInfo;
            $(".resetsInText").text(
              generateResetsInText(
                resetsInSeconds,
                isCancelled,
                isPaid,
                nextPlanInfo
              )
            );

            if (plan.hasVideoScreenshot === true) {
              settingsManager.get("copyScreenshotUnlocked").then(
                (previousSetting) => {
                  if (previousSetting !== true) {
                    $("#copyVideoScreenshotOnVideoPause").prop("checked", true);
                    $("#copyVideoScreenshotOnVideoPause").trigger("change");
                    $("#copyVideoScreenshotKeyboardShortcut").prop("checked", true);
                    $("#copyVideoScreenshotKeyboardShortcut").trigger("change");
                  } 

                  settingsManager.set({"copyScreenshotUnlocked": true});
                }
              )
              $(".lockedScreenshot").remove();
            } else {
              settingsManager.set({"copyScreenshotUnlocked": false});
              $("#copyVideoScreenshotOnVideoPause").prop("checked", false);
              $("#copyVideoScreenshotOnVideoPause").trigger("change");
              $("#copyVideoScreenshotKeyboardShortcut").prop("checked", false);
              $("#copyVideoScreenshotKeyboardShortcut").trigger("change");
              $("#copyVideoScreenshotOnVideoPause").change(() => {})
              $("#copyVideoScreenshotKeyboardShortcut").change(() => {})

              $(".copyScreenshotFullyDisabled").css("visibility", "hidden");
            }
          }
        });
      }
    })
    .catch((e) => {});

  $(".siteNameHeader").text(domain);

  if (!(await settingsManager.isSelectextEnabled())) {
    showResumeButton(domain);
  }

  $("#" + (await settingsManager.get("copyMode"))).prop("checked", true);

  $("#" + (await settingsManager.get("textDisplay"))).prop("checked", true);
}

async function getDomainForSite() {
  let tabs = await browser.tabs.query({ currentWindow: true, active: true });
  let activeTab = tabs[0];
  let domain = getSiteNameFromURL(activeTab.url);
  return domain;
}

function showResumeButton(domain) {
  $(".pauseAlwaysButton").remove();
  $("<button></button>")
    .addClass("selectextButton")
    .text(`Resume on ${domain}`)
    .appendTo(".selectextRunOnWrapper")
    .click(() => onResumeClick().catch((e) => {}));
}

async function onResumeClick() {
  await settingsManager.resumeSelectext();

  window.close();
}

function onSettingsLoaded() {}

async function initSettingsState() {
  $("#copyTextFromVideosOnVideoPause").attr(
    "checked",
    await settingsManager.get("copyTextToggleChecked")
  );
  $("#copyTextFromVideosKeyboardShortcut").attr(
    "checked",
    await settingsManager.get("copyTextKeyboardShortcutChecked")
  );
  $("#copyVideoScreenshotOnVideoPause").attr(
    "checked",
    await settingsManager.get("copyScreenshotToggleChecked")
  );
  $("#copyVideoScreenshotKeyboardShortcut").attr(
    "checked",
    await settingsManager.get("copyScreenshotKeyboardShortcutChecked")
  );

  handleDisabledWarnings();
}

async function handleDisabledWarnings() {
  const isCopyTextFullyDisabled = checkIfCopyTextFullyDisabled();
  const isCopyScreenshotFullyDisabled = await checkIfCopyScreenshotFullyDisabled();

  if (isCopyTextFullyDisabled || isCopyScreenshotFullyDisabled) {
    $(".settingsAlert").css("visibility", "visible");
  } else {
    $(".settingsAlert").css("visibility", "hidden");
  }
}

function switchBackToPopupPage() {
  $(".settingsWrapper").css("display", "none");
  $(".mainPopupPageWrapper").css("display", "block");
  handleDisabledWarnings();
}

function addSettingsEventListeners() {
  $(".backButtonWrapper").click(switchBackToPopupPage);

  $(".backButtonWrapper").hover(
    () => $(".backArrowIcon").attr("src", "images/back-arrow-black.svg"),
    () => $(".backArrowIcon").attr("src", "images/back-arrow-grey.svg")
  );

  $("#copyTextFromVideosOnVideoPause").change((e) => {
    settingsManager.set({ copyTextToggleChecked: e.target.checked });
    checkIfCopyTextFullyDisabled();
  });

  $("#copyTextFromVideosKeyboardShortcut").change((e) => {
    settingsManager.set({ copyTextKeyboardShortcutChecked: e.target.checked });
    checkIfCopyTextFullyDisabled();
  });

  $("#copyVideoScreenshotOnVideoPause").change((e) => {
    settingsManager.set({ copyScreenshotToggleChecked: e.target.checked });
    checkIfCopyScreenshotFullyDisabled();
  });

  $("#copyVideoScreenshotKeyboardShortcut").change((e) => {
    settingsManager.set({
      copyScreenshotKeyboardShortcutChecked: e.target.checked,
    });
    checkIfCopyScreenshotFullyDisabled();
  });

  $(".lockedScreenshot").hover(() => {
    $(".coverOverlay").css("opacity", "100%");
    $(".lockedScreenshot").append($("<button class='upgradeToProButton selectextButton'></button").text("Upgrade to a Pro plan to unlock"))
  }, () => {
    $(".coverOverlay").css("opacity", "0%");
    $(".lockedScreenshot button").remove();
  })

  $(".lockedScreenshot").click((e) => {
    browser.tabs.create({url: `${WEBSITE_URL}/portal/plans`})
  })

}

function checkIfCopyTextFullyDisabled() {
  if (
    $("#copyTextFromVideosOnVideoPause").is(":checked") === false &&
    $("#copyTextFromVideosKeyboardShortcut").is(":checked") === false
  ) {
    $(".copyTextFullyDisabled").css("visibility", "visible");
    return true;
  } else {
    $(".copyTextFullyDisabled").css("visibility", "hidden");
    return false;
  }
}

async function checkIfCopyScreenshotFullyDisabled() {
  if (
    $("#copyVideoScreenshotOnVideoPause").is(":checked") === false &&
    $("#copyVideoScreenshotKeyboardShortcut").is(":checked") === false &&
    BROWSER_TYPE !== "firefox" && await settingsManager.get("copyScreenshotUnlocked") === true
  ) {
    $(".copyScreenshotFullyDisabled").css("visibility", "visible");
    return true;
  } else {
    $(".copyScreenshotFullyDisabled").css("visibility", "hidden");
    return false;
  }
}

async function switchToSettingsPage() {
  $(".selectextPopupWrapper").css(
    "height",
    $(".selectextPopupWrapper").height()
  );
  $(".mainPopupPageWrapper").css("display", "none");
  if (BROWSER_TYPE === "firefox") {
    $(".copyVideoScreenshotWrapper").remove();
  }
  $(".settingsWrapper").css("display", "flex");

  $(".copyVideoScreenshotWrapper").css("padding-top", "20px");
  $(".lockedScreenshot").height($(".copyVideoScreenshotWrapper").height())
}

/**
 * Add click event listeners to UI components
 * {Element} youtubeToggle the HTML element representing the toggle for Youtube
 * {Element} uoaToggle the HTML element representing the toggle for uoa
 */
function addEventListenersToComponents() {
  $(".userIcon").click(() =>
    browser.tabs.create({ url: `${WEBSITE_URL}/portal/account` })
  );
  $(".pauseAlwaysButton").click(onPauseAlways);
  $("#multiline").click(setMultiLineMode);
  $("#singleline").click(setSingleLineMode);
  $("#indentation").click(setIndetationMode);

  $("#boxes").click(setBoxesMode);
  $("#transparent").click(setTransparentMode);

  $(".shortcutDisplay").click(() =>
    browser.tabs.create({ url: EXTENSION_SHORTCUTS_URL })
  );

  $(".settingsIcon").hover(
    function () {
      $(this).attr("src", "images/settings-rotated.svg");
    },
    function () {
      $(this).attr("src", "images/settings.svg");
    }
  );

  $(".settingsIcon").click(() => {
    switchToSettingsPage();
    onSettingsLoaded();
  });
}

function setMultiLineMode() {
  settingsManager.set({ copyMode: "multiline" });
}

function setSingleLineMode() {
  settingsManager.set({ copyMode: "singleline" });
}

function setIndetationMode() {
  settingsManager.set({ copyMode: "indentation" });
}

function setBoxesMode() {
  settingsManager.set({ textDisplay: "boxes" });
}

function setTransparentMode() {
  settingsManager.set({ textDisplay: "transparent" });
}

async function onPauseAlways() {
  await settingsManager.pauseSelectext();

  window.close();
}
