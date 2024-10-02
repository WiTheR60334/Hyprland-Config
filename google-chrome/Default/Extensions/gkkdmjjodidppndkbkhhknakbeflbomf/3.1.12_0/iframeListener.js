
if (!inIframe()) {

    window.addEventListener("message", function (event) {  
        if (event.data !== undefined && event.data.type !== undefined) {
            if (event.data.iframeSrc !== undefined) {
                const iframeSrc = event.data.iframeSrc;
                let iframe = $(`iframe[src*='${iframeSrc}']`).get(0);
                // If the iframe changed its domain since initial load, use the sitename instead with contains search
                if (iframe === undefined) {
                    iframe = $(`iframe[src*='${getSiteNameFromURL(iframeSrc)}']`).get(0);
                }
                if (iframe !== undefined) {
                    if (event.data.type === "SELECTEXT_IFRAME_DIMENSIONS_REQUEST") {
                        returnIframeDimensions(iframe);
                    }

                    if (event.data.type === "SELECTEXT_IFRAME_URL_REQUEST") {
                        returnPageURL(iframe);
                    }

                    if (event.data.type === "SELECTEXT_IFRAME_ATTACH_MOUSEUP_HANDLER") {
                        const mouseupHandler = (e) => {
                            e.stopPropagation()
                            const iframeDimensions = iframe.getBoundingClientRect();
                            const eventCoordsOnly = _.pick(e, ["clientX", "clientY"]);
                            eventCoordsOnly.clientX = eventCoordsOnly.clientX - iframeDimensions.left;
                            eventCoordsOnly.clientY = eventCoordsOnly.clientY - iframeDimensions.top;
                            iframe.contentWindow.postMessage({
                                type: "SELECTEXT_IFRAME_MOUSEUP_HANDLER_FIRED",
                                event: eventCoordsOnly
                            }, "*");
                        }
        
                        window.addEventListener(
                            "mouseup",
                            mouseupHandler,
                            {
                                capture: true,
                                once: true
                            }
                        )
                    }

                    if (event.data.type === "COPY_DATA_URI_TO_CLIPBOARD") {
                        copyDataUriToClipboardHandler(iframe, event.data.dataUri);
                    }
                }
            }

            if (event.data.type === "SELECTEXT_IFRAME_COPY") {
                copyToClipboard(event.data.text);
            }

            
        }
    });

    function returnIframeDimensions(iframe) {
        const iframeDimensions = iframe.getBoundingClientRect();
        const viewportDimensions = getViewportDimensions();
        iframe.contentWindow.postMessage({
            type: "SELECTEXT_IFRAME_DIMENSIONS_RESPONSE",
            iframeDimensions: iframeDimensions,
            viewportDimensions: viewportDimensions
        }, "*");
    }

    function returnPageURL(iframe) {
        iframe.contentWindow.postMessage({
            type: "SELECTEXT_URL_RESPONSE",
            url: window.location.href
        }, "*");
    }

    function copyDataUriToClipboardHandler(iframe, dataUri) {
        const blob = dataURItoBlob(dataUri);

        let resType;
        try {
            copyPngBlobToClipboardChrome(blob);
            resType = "COPY_DATA_URI_TO_CLIPBOARD_SUCCESS";
        } catch(e) {
            resType = "COPY_DATA_URI_TO_CLIPBOARD_FAILED";
        }

        iframe.contentWindow.postMessage({
            type: resType
        }, "*")
    }

    function dataURItoBlob(dataURI) {
        // convert base64 to raw binary data held in a string
        // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
        var byteString = atob(dataURI.split(',')[1]);
      
        // separate out the mime component
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
      
        // write the bytes of the string to an ArrayBuffer
        var ab = new ArrayBuffer(byteString.length);
      
        // create a view into the buffer
        var ia = new Uint8Array(ab);
      
        // set the bytes of the buffer to the correct values
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
      
        // write the ArrayBuffer to a blob, and you're done
        var blob = new Blob([ab], {type: mimeString});
        return blob;
      
      }
}
