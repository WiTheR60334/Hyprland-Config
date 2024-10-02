
// chrome.storage.sync.clear()
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));


var defaults = {
  method: 'crop',
  format: 'png',
  quality: 100,
  scaling: true,
  save: ['file'],
  clipboard: 'url',
  dialog: true,
  icon: 'default',
}

chrome.storage.sync.get((store) => {
  var config = {}
  Object.assign(config, defaults, JSON.parse(JSON.stringify(store)))
  // v3.0 -> v3.1
  if (typeof config.save === 'string') {
    config.clipboard = /url|binary/.test(config.save) ? config.save : 'url'
    config.save = /url|binary/.test(config.save) ? ['clipboard'] : ['file']
  }
  if (config.dpr !== undefined) {
    config.scaling = config.dpr
    delete config.dpr
  }
  if (typeof config.icon === 'boolean') {
    config.icon = config.icon === false ? 'default' : 'light'
  }
  chrome.storage.sync.set(config)

})

function inject (tab) {
  chrome.tabs.sendMessage(tab.id, {message: 'init'}, (res) => {
    if (res) {
      clearTimeout(timeout)
    }
  })

  var timeout = setTimeout(() => {
    chrome.scripting.insertCSS({files: ['vendor/jquery.Jcrop.min.css'], target: {tabId: tab.id}})
    chrome.scripting.insertCSS({files: ['content/index.css'], target: {tabId: tab.id}})

    chrome.scripting.executeScript({files: ['vendor/jquery.min.js'], target: {tabId: tab.id}})
    chrome.scripting.executeScript({files: ['vendor/jquery.Jcrop.min.js'], target: {tabId: tab.id}})
    chrome.scripting.executeScript({files: ['content/crop.js'], target: {tabId: tab.id}})
    chrome.scripting.executeScript({files: ['content/index.js'], target: {tabId: tab.id}})

    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, {message: 'init'})
    }, 100)
  }, 100)
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'take-screenshot') {
    chrome.tabs.query({active: true, currentWindow: true}, (tab) => {
      inject(tab[0])
    })
  }
})

chrome.runtime.onMessage.addListener((req, sender, res) => {
  if (req.message === 'capture') {
    chrome.tabs.query({active: true, currentWindow: true}, (tab) => {
      chrome.tabs.captureVisibleTab(tab.windowId, {format: req.format, quality: req.quality}, (image) => {
        // image is base64
        res({message: 'image', image})
      })
    })
  }
  return true
})

chrome.runtime.onMessage.addListener((message, sender) => {
  (async () => {
    if(message.command==="open-sidebar"){
      await chrome.sidePanel.open({ tabId: sender.tab.id });
      await chrome.sidePanel.setOptions({
        tabId: sender.tab.id,
        path: "sidepanel.html?frombackground=true",
        enabled: true
      });
    }else if(message.command == "remove-sidepanel"){
      await chrome.sidePanel.setOptions({
        tabId: sender.tab.id,
        path: "sidepanel.html",
        enabled: true
      });
    }
  })();
});
