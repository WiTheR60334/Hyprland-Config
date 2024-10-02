var dontRunSiteList = []

/**
 * Load custom fonts by injecting font face property into css. This method is preferred for firefox/chrome compatibility.
 */
function loadCustomFonts() {
    if (document.head === null) {
        return;
    }

    let openSansRegular = document.createElement("style");
    openSansRegular.textContent = `@font-face {
              font-family: 'Open Sans Regular';
              font-style: normal;
              font-weight: 400;
              src: url('${browser.runtime.getURL(
        "fonts/open_sans/open-sans-v18-latin-regular.woff"
    )}');
          }`;

    document.head.appendChild(openSansRegular);

    let openSansBold = document.createElement("style");
    openSansBold.textContent = `@font-face {
              font-family: 'Open Sans Bold';
              font-style: normal;
              font-weight: 800;
              src: url('${browser.runtime.getURL(
        "fonts/open_sans/OpenSans-Bold.woff"
    )}');
          }`;

    document.head.appendChild(openSansBold);

    let openSansExtraBold = document.createElement("style");
    openSansExtraBold.textContent = `@font-face {
              font-family: 'Open Sans ExtraBold';
              font-style: normal;
              font-weight: 800;
              src: url('${browser.runtime.getURL(
        "fonts/open_sans/open-sans-v18-latin-800.woff"
    )}');
          }`;
    document.head.appendChild(openSansExtraBold);
}


function getSiteNameFromURL(url) {
    if (url.startsWith("file")) {
        return "Local File";
    }

    if (url.startsWith("chrome")) {
        return null;
    }

    let { hostname } = new URL(url);

    if (hostname === "chrome.google.com") {
        return null;
    }

    if (hostname.startsWith("www.")) {
        hostname = hostname.replace("www.", "")
    }

    if (dontRunSiteList.includes(hostname)) {
        return null;
    }

    if (hostname === "") {
        return null;
    }

    return hostname;
}