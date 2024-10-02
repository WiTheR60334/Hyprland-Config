 chrome.runtime.onInstalled.addListener(function (tabId, changeInfo, tab) { 

  chrome.storage.sync.set(
    {
      key: "1",
    },
    function () {}
  );


    return false;
     
});


const params = {
  active: true,
  currentWindow: true,
};



chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  chrome.storage.sync.get(["key"], function (result) {
    chrome.tabs.query(params, (tabs) => {
      chrome.tabs.sendMessage(tab.id, result.key);
    });
  });
});

(getRandomToken = () => {
  var e = new Uint8Array(32);
  crypto.getRandomValues(e);
  for (var t = "", n = 0; n < e.length; ++n) t += e[n].toString(16);
  return t;
}),
  (preload = () => {
    chrome.runtime.onInstalled.addListener(function (e) {
      "install" == e.reason
        ? chrome.storage.sync.set({ userid: getRandomToken() })
        : "update" == e.reason &&
          (chrome.runtime.getManifest().version,
          chrome.storage.sync.get("userid", (e) => {
            e.userid || chrome.storage.sync.set({ userid: getRandomToken() });
          }));
    });
  }),
  (main = () => {
    preload();
  })(),

  chrome.runtime.setUninstallURL('https://bit.ly/vispeedui');



chrome.commands.onCommand.addListener(function (command) {
  console.log("onCommand event received for message: ", command);

  switch (command) {
    case "left":
      console.log("Left");
      chrome.storage.sync.get(["key"],function(result){
        console.log(result.key, "before")
       if(result.key>=0.25){
         
         console.log("hello")
        chrome.storage.sync.set({
          key:Number(result.key-0.25),
        })

        chrome.tabs.query({    
          active: true,
          currentWindow: true,
        }, (tabs) => {
          console.log(tabs)
          chrome.tabs.sendMessage(tabs[0].id, Number(result.key));
        });

       }else{
          result.key=0.25
       }
      });   
      break;

    case "right":
      console.log("right")
      chrome.storage.sync.get(["key"],function(result){
        if(result.key <=4.00){
          chrome.storage.sync.set({
            key:Number(result.key+0.25),         
          })
          chrome.tabs.query({    
            active: true,
            currentWindow: true,
          }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, Number(result.key));
          });
  
        }else{
          result.key=4.00;
        }    
 
      })
      break;
  }
});

chrome.runtime.onInstalled.addListener(function (details) {
  console.log(details);

if (details.reason == chrome.runtime.OnInstalledReason.INSTALL) {
chrome.tabs.create({
url: ' https://bit.ly/vispeedi'
});
}
})
 

