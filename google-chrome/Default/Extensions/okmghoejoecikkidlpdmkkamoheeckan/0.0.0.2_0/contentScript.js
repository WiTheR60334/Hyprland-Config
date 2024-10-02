function sendData(event){
    chrome.runtime.sendMessage({ send: { method: 'sendTxt', txt: document.getSelection().toString() } })
    event.path[0].className+=' jsPointer'
    console.log(document.getSelection().toString() )
}
function allowCopy(e) {
    if(document.getSelection().toString().trim() !== ''){
            sendData(e)
}
    }

    var working=true

    if(working){
        document.addEventListener('copy',allowCopy)
}
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.send.method == 'stop') {
            document.removeEventListener('copy',allowCopy)
            working=false
        }
        if(request.send.method == 'areYouInjected?'){
            if(!working){
                document.addEventListener('copy',allowCopy)
                working=true
                sendResponse({answer:true})
            }
        }
    }
);
