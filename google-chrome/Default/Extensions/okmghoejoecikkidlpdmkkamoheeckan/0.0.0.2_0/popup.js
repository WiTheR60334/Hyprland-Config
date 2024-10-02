/*
additional features to add:
1- control the size of the window for big screens (pc screen only not mobile or tablets)
2-ability to switch between read only to edit in case where user want to edit his text and then return it back to the read only case, this feature
will require few things to know first:
a-how to split string on each new line
b- reverse step a
*/

//Cnt is short for container for example noteCnt means noteContainer
// responsable for get and set data from localStorage
function store() {
  return {
    get: (name, callback) => {
      chrome.storage.local.get([name], callback)
    },
    set: (name, callback) => chrome.storage.local.set(name, callback)
  }
}

function $(el) {
  return document.querySelector(el)
}
$['create']=(el)=>{
  return document.createElement(el)
}
//refrence to the main buttons (copyAll ,start , stop)
function MainBtns() {
  return {
    copy: $('#copy'),
    inject: $('#inject'),
    stop: $('#stop')
  }
}

//utility functions

function copyAllText(arr) {
  if (!arr) return;
  let temp = $.create('textarea')
  document.body.append(temp)
  for (let i = 0; i < arr.length; i++) {
    temp.innerHTML += arr[i].value + '\n'
  }
  temp.select()
  document.execCommand('copy')
  temp.remove()
}

function copySingle(txt) {
  let store = $.create('textarea')
  document.body.append(store)
  store.innerHTML = txt
  store.select()
  document.execCommand('copy')
  // console.log(txt)
  store.remove()

}
async function selfDelete(e) {
  let elementIndex = +e.currentTarget.parentNode.parentNode.getAttribute('index')
  chrome.runtime.sendMessage({ send: { method: 'deleteNote', index: elementIndex } })
  await resetNoteIndex(elementIndex)
   e.currentTarget.parentNode.parentNode.remove()
}



//get data when pop launches

let dataCnt = $('#data')

store().get('notes', createNote)
btnState().get()


MainBtns().copy.addEventListener('click', () => {
  chrome.storage.local.get(['notes'], function (result) {
    copyAllText(result.notes)
  })
})



MainBtns().inject.addEventListener('click', function () {
  btnState().set(true)
  chrome.runtime.sendMessage({ send: { method: 'startWorking' } })
})


MainBtns().stop.addEventListener('click', function () {
  btnState().set(false)
  chrome.runtime.sendMessage({ send: { method: 'sendStop' } })
})

/*
1-right click menu event
2-inject that right click event to the current page
3-adding saved text to the extention

*/

function resetNoteIndex(currentIndex){
for(let i=0;i<dataCnt.children.length;i++){  
    if(+dataCnt.children[i].getAttribute('index')>currentIndex){
      dataCnt.children[i].setAttribute('index',i-1)
    }
}
}
function addAttr(el,val){   
var att = document.createAttribute("index");       
att.value = val;
el.setAttributeNode(att); 
}
function createNote(result) {
  if(!result) return
  result.notes.map((el, i) => {
    //Cnt is short for container for example noteCnt means noteContainer
    let noteCnt = $.create('div')
    noteCnt.id = 'note'
    let note = $.create('p')
    let btnsCnt = $.create('div')
    btnsCnt.id = 'btns-cnt'
    let selfDeleteBtn = $.create('button')
    let selfCopyBtn = $.create('button')
    selfDeleteBtn.innerHTML = 'X'
    selfCopyBtn.innerHTML = '<i class="fa fa-copy"></i>'
    selfDeleteBtn.id = 'self-delete'
    selfCopyBtn.id = 'self-copy'
    addAttr(noteCnt,i)
    //self delete event
    selfDeleteBtn.addEventListener('click', selfDelete)
    //self copy event
    selfCopyBtn.addEventListener('click', (e) => {
      copySingle(e.path[3].children[i].children[0].innerText)
    })
    // append stored data and buttons to each note
    note.innerText = el.value
    btnsCnt.append(selfCopyBtn, selfDeleteBtn)
    noteCnt.append(note, btnsCnt)
    dataCnt.append(noteCnt)

  })
}


function stateCheck(state) {
  if (state) {
    MainBtns().inject.disabled = true
    MainBtns().stop.disabled = false
  } else {
    MainBtns().inject.disabled = false
    MainBtns().stop.disabled = true
  }
}

function getBtnState() {
  store().get('active', (res) => stateCheck(res.active))
}
function setBtnState(state) {
  store().set({ active: state }, () => stateCheck(state))
}

function btnState() {
  return {
    get: () => store().get('active', (res) => stateCheck(res.active)),
    set: (val) => store().set({ active: val }, stateCheck(val))
  }
}