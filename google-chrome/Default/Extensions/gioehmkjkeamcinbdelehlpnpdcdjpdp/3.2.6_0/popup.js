let sliderValue = document.getElementById("myRange");
const resetBtn = document.getElementById("resetbtn");


document.querySelector("title").textContent = chrome.i18n.getMessage("extName");
resetBtn.innerHTML = chrome.i18n.getMessage("reset");

window.onload = function () {
  
  chrome.storage.sync.get(["key"], function (result) {
    sliderValue.value = result.key;
    setValue();
    
    const params = {
      active: true,
      currentWindow: true,
    };
    
    
    chrome.tabs.query(params, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, result.key);
    });
  });
};

resetBtn.addEventListener("click", function () {
  const params = {
    active: true,
    currentWindow: true,
  }; 
  
  sliderValue.value = "1";
  setValue(); 

  chrome.storage.sync.set(
    {
      key: "1",
    },
    function () { }
  );
  chrome.tabs.query(params, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, "1");
  });
});


sliderValue.addEventListener("change", () => {
  const params = {    
    active: true,
    currentWindow: true,
  };

  var storeValue = sliderValue.value;
  chrome.storage.sync.set(
    {
      key: storeValue,
    },
    function () { }
  );

  chrome.tabs.query(params, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, storeValue);
  });
});





  

  document.getElementById("minus").addEventListener("click", decreaseSpeed);
  document.getElementById("plus").addEventListener("click", increaseSpeed);
  
  
  function decreaseSpeed(){
    sliderValue.value = sliderValue.value-0.25; 
    setValue(); 

    const params = {    
      active: true,
      currentWindow: true,
    };
    chrome.storage.sync.set(
      {
        key: sliderValue.value,

      },
      function () {}
    );
  

    chrome.storage.sync.get(["key"], function (result) {
      
    });

  
    chrome.tabs.query(params, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, sliderValue.value);
    });
    

  }
  function increaseSpeed(){
    sliderValue.value = Number(sliderValue.value)+0.25;
    setValue();


    const params = {    
      active: true,
      currentWindow: true,
    };
    chrome.storage.sync.set(
      {
        key: sliderValue.value,

      },
      function () {}
    );
  
    chrome.storage.sync.get(["key"], function (result) {
      
    });
  
    chrome.tabs.query(params, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, sliderValue.value);
    });

  }

chrome.commands.onCommand.addListener(function (command) {
 

  switch (command) {
    case "left":
      console.log("Left");
      sliderValue.value= sliderValue.value - 0.25;
      setValue();

      chrome.storage.sync.set(
        {
          key: sliderValue.value,

        },
        function () { }
      );
    

      chrome.tabs.query({    
        active: true,
        currentWindow: true,
      }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, sliderValue.value);
      });
      
      break;

    case "right":
      sliderValue.value = Number(sliderValue.value)+0.25;

      setValue();


      chrome.storage.sync.set(
        {
          key: document.getElementById("myRange").value,

        },
        function () {}
      );
    
      chrome.storage.sync.get(["key"], function (result) {
      });
    
      chrome.tabs.query({    
        active: true,
        currentWindow: true,
      }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, document.getElementById("myRange").value);
      });
      
      break;
  }
});


// ***********************************


  const rangeV = document.getElementById('rangeV'),

  setValue = ()=>{
    const
      newValue = Number( (sliderValue.value - sliderValue.min) * 100 / (sliderValue.max - sliderValue.min) ),
      newPosition = 10 - (newValue * 0.2);

    rangeV.innerHTML = `<span>${sliderValue.value +"x"}</span>`;
    rangeV.style.left = `calc(${newValue}% + (${newPosition}px))`;
    
    var ran=rangeV.style.left;


    

  };


document.addEventListener("DOMContentLoaded", setValue);
sliderValue.addEventListener('input', setValue);