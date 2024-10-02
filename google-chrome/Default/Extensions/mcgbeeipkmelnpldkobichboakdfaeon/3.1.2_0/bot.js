window.addEventListener('locationchange', function () {
    reacctchBtn()
});
var  extractCodeBlocks = () => {
    var textarea = document.querySelector("#read-only-cursor-text-area");
    if(textarea){
        return {
            "code-type":"file",
            "contents": textarea.innerHTML
        };
    }
    var contents = "";
    var diffEntries = document.querySelectorAll("copilot-diff-entry");
    if(diffEntries.length>0){
        contents = "Commit Details for "+window.location.href+"\n\n";
        
        diffEntries.forEach((diffEntry)=>{
            var div = diffEntry.querySelector("div");
            var fileName = div.getAttribute("data-tagsearch-path");
            contents += `\n==========================\nStart file ${fileName}\n==========================\n`;
            var table = diffEntry.querySelector("table");
            if(table){
                let diffHTML  = diffEntry.querySelector('table').innerHTML
                let htmlString = diffHTML
                let elementsWithMarker = document.createElement('template');
                elementsWithMarker.innerHTML = htmlString;
                let elements = elementsWithMarker.content.querySelectorAll('[data-code-marker]');
                let resultString = '';
    
                for (let el of elements) {
                    if (el.getAttribute('data-code-marker')) {
                        resultString += el.getAttribute('data-code-marker') + el.innerText + '\n';
                    }
                }
                contents += resultString + '\n\n'
                
                // contents += table.innerText+"\n\n";     // old method not good
            }
            contents += `\n==========================\nend file ${fileName}\n==========================\n`;
        })
        
        return {
            "code-type":"commit",
            "contents": contents
        };
    }

    var documentClone = document.cloneNode(true);
    var article = new Readability(documentClone).parse();
    if(article){
        var turndownService = new TurndownService()
        var markdown = turndownService.turndown(article.content)
        
        return {
            "code-type":"webpage",
            "contents": markdown
        };    
    }
    var content = document.querySelector("body");
    return {
        "code-type":"webpage",
        "contents": content.innerText
    };
}
var sideBarOpened = false;
chrome.runtime.onConnect.addListener(sidebarPort=>{
    sideBarOpened = true;
    sidebarPort.onDisconnect.addListener(e=>{
        sideBarOpened = false;
        chrome.runtime.sendMessage({
            "command": "remove-sidepanel",
            "from":"content-script",
        });
    })
})
var passContentToChatPanel = (question=null) => {
    if(question){
        let codeBlock = extractCodeBlocks();
        chrome.runtime.sendMessage({
            "url": window.location.href,
            "codeBlock": codeBlock['contents'],
            "codeBlockType": codeBlock['code-type'],
            "command": "question-replay",
            "question": question
        });
        return;
    }
    let codeBlock = extractCodeBlocks();
    chrome.runtime.sendMessage({
        "url": window.location.href,
        "codeBlock": codeBlock['contents'],
        "codeBlockType": codeBlock['code-type'],
        "command": "explain-code"
    });
}
var reacctchBtn = () => {

    if(document.querySelector("#blackbox-explain-btn")){
        return;
    }

    var buttonContainer = document.querySelector(".Box-sc-g0xbh4-0.iBylDf")
    var bboxButton = new DOMParser().parseFromString('<span id="blackbox-explain-btn" class=""><button type="button" style=" padding: 0px 8px; height: 28px; gap: 4px; font-size: 12px; background: none; color: rgb(201, 209, 217); border: none; " class="types__StyledButton-sc-ws60qy-0 evsEvO" data-size="small">💬 Code Chat</button></span>', 'text/html')
    if(!buttonContainer){
        buttonContainer = document.querySelector(".commit.full-commit.mt-0.px-2.pt-2");
        var bboxButton = new DOMParser().parseFromString('<span id="blackbox-explain-btn" class=""><button type="button" style=" padding: 0px 8px; height: 28px; gap: 4px; font-size: 12px; background: none; color: rgb(201, 209, 217); border: none; " class="btn float-right" data-size="small">💬 Code Chat</button></span>', 'text/html')
    }
    var blackboxButton = bboxButton.body.firstChild;
    if(buttonContainer){
        buttonContainer.insertBefore(blackboxButton, buttonContainer.firstChild)
        blackboxButton.onclick = (e) =>{
            if(!sideBarOpened){
                chrome.runtime.sendMessage({
                    "command": "open-sidebar",
                    "sideBarOpened": sideBarOpened,
                    "from":"content-script"
                });
            }
            passContentToChatPanel();
        }
    }
}
reacctchBtn()
// chrome.runtime.sendMessage({
//     "command": "explain-code"
// });


var reacctchBtnInterval = setInterval(()=>{
    reacctchBtn()
}, 1000);

chrome.runtime.onMessage.addListener(function(request, sender) {
    if(request?.from == "chat-panel" && request?.command=="get-content"){
        passContentToChatPanel();
    }else if (request?.from == "chat-panel" && request?.command=="include-context" && request?.question){
        passContentToChatPanel(request?.question);
    }
});