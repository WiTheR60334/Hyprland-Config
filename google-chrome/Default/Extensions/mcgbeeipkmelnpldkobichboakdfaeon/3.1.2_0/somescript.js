var burl = "https://www.blackbox.ai/"
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse){
        if(request.command==="explain-code"){
            var chatPanel = document.querySelector("iframe")
            chatPanel.contentWindow.postMessage({"command":"explain-code", "url":request.url, "codeBlock": request.codeBlock, "codeBlockType": request.codeBlockType}, "*")
        }else if(request.command === "question-replay"){
            var chatPanel = document.querySelector("iframe")
            chatPanel.contentWindow.postMessage(request, "*")
        }
    }
);
window.onmessage = (e)=>{
    if(e?.data?.from == "chat-panel" && (e?.data?.command == "get-content" || e?.data?.command == "include-context")){
        chrome.tabs.query({active: true, currentWindow: true}, async(tabs) => {
            let tab = tabs[0];
            await chrome.tabs.sendMessage(tab.id, e.data);
        });
    }
}

// if(window.location.href.includes("?frombackground=true")){
//     console.log("opened via background")
//     document.querySelector("iframe").src = burl+"?frameurl="+1    
// }else{
//     document.querySelector("iframe").src = burl;
// }
document.querySelector("iframe").src = burl+"?chrome=true&frameurl="+1

chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    chrome.tabs.connect(tabs[0].id);
});    
