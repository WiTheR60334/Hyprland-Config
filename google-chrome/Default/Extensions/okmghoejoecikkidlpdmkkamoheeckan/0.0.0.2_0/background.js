chrome.runtime.onInstalled.addListener(function() {
    store().set({ active: false });
    store().set({ notes: [] });
  });
  //add and get data from chrome local storage
function store() {
    return {
      get: (name, callback) => {
        chrome.storage.local.get([name], callback)
      },
      set: (name, callback) => chrome.storage.local.set(name, callback)
    }
  }

chrome.windows.onCreated.addListener(function () {
    store().set({ active: false });
    store().set({ notes: [] });
})

//remove the note from storage when user delete single note
function deleteNote(noteIndex) {
    store().get('notes', function (notesArray) {
        notesArray.notes.splice(noteIndex,1)
        store().set({ notes: notesArray.notes },function(){
        });
    });
}

//check if the user note is copying is already exist in the storage or not
function uniqueValueCheck(value, id) {
    store().get('notes', function (notesObject) {
        if (!notesObject) return
        for (let i = 0; i < notesObject.notes.length; i++) {
            if (notesObject.notes[i].value === value) {
                return;
            }
        }
        let newNotes;
        newNotes = notesObject.notes
        newNotes.push({ value, id })
        store().set({ notes: newNotes });
    })
}
//inject the tab with contentScript file on url change
function onTabUpdated(tabId, changeInfo, tab) {
    //&& /^http/.test(changeInfo.url) || changeInfo.url === undefined && changeInfo.status === 'complete'
    if (changeInfo.url && changeInfo.status === 'loading') {
        
        chrome.tabs.executeScript(tabId, { file: 'contentScript.js' })
    }
}
//inject new created tab contentScript file on tab creation
function onTabCreated(tab) {
    if (tab.url) {
        chrome.tabs.executeScript(tab, { file: 'contentScript.js' })
    }
}
let injectedTabs = []
// simply injects the contentScript file 
function scriptsInjection(tab) {
    for (let i = 0; i < tab.length; i++) {
        if (tab[i] && !/^chrome/.test(tab[i].url)) {
            if (injectedTabs.length > 1 && injectedTabs.includes(tab[i].id)) {
                chrome.tabs.sendMessage(tab[i].id, { send: { method: 'areYouInjected?' } }, {})
            } else {
                injectedTabs.push(tab[i].id)
                chrome.tabs.executeScript(tab[i].id, { file: 'contentScript.js' })
            }
        }
    }
}

function addAllListeners() {
    chrome.tabs.onUpdated.addListener(onTabUpdated)
    chrome.tabs.onCreated.addListener(onTabCreated)
    chrome.tabs.query({ active: null }, scriptsInjection)
}
//code need to be modified
// function removeAllListeners() {
//     chrome.tabs.onUpdated.removeListener(onTabUpdated)
//     chrome.tabs.onCreated.removeListener(onCreatedListener)
//     chrome.tabs.query({ active: null }, scriptsInjection)
// }

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.send.method == 'sendTxt') {
            uniqueValueCheck(request.send.txt, sender.tab.id)
        }
        if (request.send.method == 'deleteNote') {
            deleteNote(request.send.index)
        }

        if (request.send.method == 'startWorking') {
            //set wither the extension is on or off
            store().set({ active: true });
            addAllListeners()
        }
        if (request.send.method == 'sendStop') {
            store().set({ active: false });
            chrome.tabs.query({}, function (tab) {
                for (let i = 0; i < tab.length; i++) {
                    chrome.tabs.sendMessage(tab[i].id, { send: { method: 'stop' } })
                }
            })
        }
    }
);

//edit injected tab array to remove it and add to chrome storage instead to be persistent