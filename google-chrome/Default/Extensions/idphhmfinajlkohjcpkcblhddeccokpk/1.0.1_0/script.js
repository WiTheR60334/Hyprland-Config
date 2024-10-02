var wordList;
const initialize = async () => {
    try {
      wordList = await fetch(
        'https://api.npoint.io/91ac00bc3d335f00e13f'
      ).then((response) => response.json());
	console.log(wordList)
    } catch (e) {
	
      await new Promise((resolve) => setTimeout(resolve, refreshDelay));
      return initialize();
    }
	wordList = wordList.concat(list1)
wordList = wordList.sort((a, b) => {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

wordList = JSON.stringify(wordList);
wordList = wordList.substring(1, wordList.length - 1);

}
var list1 = ['urn', 'bulletproof', 'lorry', 'mathematics', 'multiplication', 'flight', 'traffic jam', 'scratch', 'roast beef', 'onion powder', 'song', 'price', 'dream catcher', 'Socialism', 'celery', 'wrecking ball', 'ventilation', 'alphabet', 'clothes iron', 'pottery', 'sapphire', 'Dr. Watson', 'swimmer', 'bun', 'salsa', 'staff', 'NFL', 'dove', 'power', 'Death Star', 'earmuffs', 'list', 'brown', 'town', 'wet suit', 'chemistry', 'T-shirt', 'abs', 'biceps', 'long coat', 'grain', 'email', 'escalator', 'abandoned', 'actress', 'AFK', 'antlers', 'art', 'beard', 'bench press', 'Bigfoot', 'blueprint', 'boyfriend', 'Burger King', 'cable car', 'calf', 'camp', 'canoe', 'carbon', 'clothes', 'college', 'conflict', 'conveyor belt', 'CPU', 'cruise ship', 'dark', 'dish soap', 'fingerprint', 'flour', 'fry', 'Game Boy', 'gamer', 'gap', 'griffin', 'hair dryer', 'hairband', 'hangman', 'hole in one', 'jet pack', 'loud', 'mango', 'moat', 'mule', 'parking meter', 'phoenix', 'phone booth', 'pickup truck', 'pterodactyl', 'reporter', 'rock climbing', 'roller coaster', 'ruins', 'sheriff', 'ship', 'slippers', 'snack', 'stain', 'steering wheel', 'street light', 'Switzerland', 'tape measure', 'Tesla', 'Totoro', 'trace', 'United Kingdom', 'vape', 'veil', 'Wales', 'warrior']

console.log('Starting Skribbl Script')

// let wordList = await fetch('https://api.npoint.io/91ac00bc3d335f00e13f').then((response) => response.json())
var newWords = []

var containerSidebar = document.getElementById("game-chat")

let assistantPanel = document.createElement('p');

let hintBox = document.createElement('span');
let hints = ''
var currentWord = document.getElementsByClassName('container')[1]
const boxMessages = document.getElementsByClassName('chat-content')[0];
var fullWord = '';
var inputChat = document.querySelectorAll("input[type=text]")[1]
inputChat.setAttribute("placeholder","NOTE: these do not contain all the words")
// inputChat.value = 'submit'

var formChat = document.querySelectorAll("form")[0]
formChat.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true}));
// formChat.submit() it crashes

assistantPanel.appendChild(hintBox);

containerSidebar.insertBefore(assistantPanel,containerSidebar.childNodes[0]);

assistantPanel.style = `
        background: rgb(238, 238, 238);
        overflow-wrap: break-word;
        border-radius: 2px;
        border: 4px solid rgb(238, 238, 238);
        width: 100%;
        max-height: 250px;
        overflow-y: auto;
        color: rgb(57, 117, 206);
    `;

const hintClick = (event) => {
    const inputChatVal = inputChat.value;
    inputChat.value = event.target.innerHTML;
    formChat.dispatchEvent(
      new Event('submit', {
        bubbles: true,
        cancelable: true,
      })
    );
    inputChat.value = inputChatVal;
    boxMessages.scrollTop = boxMessages.scrollHeight;
  };

const hintSpan = document.createElement('a');
      hintSpan.innerHTML = hints; // wordList
      hintSpan.style.color = 'royalblue';
      hintSpan.href = 'javascript:void(0);';
	hintSpan.onclick = hintClick;


function update() {
    let word = ''
while(hintBox.firstChild){hintBox.removeChild(hintBox.firstChild)}
currentWord.childNodes.forEach(function(item) 
{
if (item.innerText.length == 0) {
		word += " "
	}
else if (item.className !== 'word-length') {
		word+=item.innerText
	} 


})

let wordRegex = word.replace(/_/g, '[^ \\-"]')
wordRegex = '"'.concat(wordRegex, '"');
wordRegex = new RegExp(wordRegex, 'g');
let hints = wordList.match(wordRegex);
console.log(hints)
hintSpan.innerHTML = hints;
	const inputChatVal = inputChat.value;
    hints.forEach((hint) => {
      const hintSpan = document.createElement('a');
      hintSpan.innerHTML = hint.substring(1,hint.length-1);
      hintSpan.style.color = 'royalblue';
      hintSpan.href = 'javascript:void(0);';
      hintSpan.onclick = hintClick;
      if (
        inputChatVal &&
        hint.toLowerCase().search(inputChatVal.toLowerCase()) !== -1
      ) {
        hintSpan.style.background = 'greenyellow';
      }
      hintBox.appendChild(hintSpan);
      hintBox.appendChild(document.createTextNode(', '));
    });
    boxMessages.scrollTop = boxMessages.scrollHeight;
    hintBox.removeChild(hintBox.lastChild);
}

function tryThis() {
try {update()} 
catch {
	console.log(fullWord)
	if(!fullWord.includes('_')) {
		newWords.push(fullWord)
	}
}}

function changed() {
	var prevWord = fullWord;
	fullWord = '' 
	currentWord.childNodes.forEach(function(item) 
	{
	if (item.innerText.length == 0) {
			fullWord += " "
		}
	else if (item.className !== 'word-length') {
			fullWord+=item.innerText
		} 
	})
	if(fullWord !== prevWord) {
		console.log('changed')
		return true;
	}
	return false;
}

checkChange = setInterval(function() { 
    if(changed()) {
		tryThis();
	}
}, 500);

function stop() {
    clearInterval(checkChange); 
}

initialize();