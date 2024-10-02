
var jcrop, selection

var overlay = ((active) => (state) => {
  active = typeof state === 'boolean' ? state : state === null ? active : !active
  $('.jcrop-holder')[active ? 'show' : 'hide']()
  chrome.runtime.sendMessage({message: 'active', active})
})(false)

var image = (done) => {
  var image = new Image()
  image.id = 'fake-image'
  image.src = chrome.runtime.getURL('/content/pixel.png')
  image.onload = () => {
    $('body').append(image)
    done()
  }
}

var init = (done) => {
  $('#fake-image').Jcrop({
    bgColor: 'none',
    onSelect: (e) => {
      selection = e
      capture()
    },
    onChange: (e) => {
      selection = e
    },
    onRelease: (e) => {
      setTimeout(() => {
        selection = null
      }, 100)
    }
  }, function ready () {
    jcrop = this

    $('.jcrop-hline, .jcrop-vline').css({
      backgroundImage: `url(${chrome.runtime.getURL('/vendor/Jcrop.gif')})`
    })

    if (selection) {
      jcrop.setSelect([
        selection.x, selection.y,
        selection.x2, selection.y2
      ])
    }

    done && done()
  })
}

var capture = (force) => {
  chrome.storage.sync.get((config) => {
    if (selection && (config.method === 'crop' || (config.method === 'wait' && force))) {
      jcrop.release()
      setTimeout(() => {
        var _selection = selection
        chrome.runtime.sendMessage({
          message: 'capture', format: config.format, quality: config.quality
        }, (res) => {
          overlay(false)
          crop(res.image, _selection, devicePixelRatio, config.scaling, config.format, (image) => {
            save(image, config.format, config.save, config.clipboard, config.dialog)
            selection = null
          })
        })
      }, 50)
    }
    else if (config.method === 'view') {
      chrome.runtime.sendMessage({
        message: 'capture', format: config.format, quality: config.quality
      }, (res) => {
        overlay(false)
        if (devicePixelRatio !== 1 && !config.scaling) {
          var area = {x: 0, y: 0, w: innerWidth, h: innerHeight}
          crop(res.image, area, devicePixelRatio, config.scaling, config.format, (image) => {
            save(image, config.format, config.save, config.clipboard, config.dialog)
          })
        }
        else {
          save(res.image, config.format, config.save, config.clipboard, config.dialog)
        }
      })
    }
    else if (config.method === 'page') {
      var container = ((html = document.querySelector('html')) => (
        html.scrollTop = 1,
        html.scrollTop ? (html.scrollTop = 0, html) : document.querySelector('body')
      ))()
      container.scrollTop = 0
      document.querySelector('html').style.overflow = 'hidden'
      document.querySelector('body').style.overflow = 'hidden'
      setTimeout(() => {
        var images = []
        var count = 0
        ;(function scroll (done) {
          chrome.runtime.sendMessage({
            message: 'capture', format: config.format, quality: config.quality
          }, (res) => {
            var height = innerHeight
            if (count * innerHeight > container.scrollTop) {
              height = container.scrollTop - (count - 1) * innerHeight
            }
            images.push({height, offset: container.scrollTop, image: res.image})

            if (
              (count * innerHeight === container.scrollTop &&
              (count - 1) * innerHeight === container.scrollTop) ||
              count * innerHeight > container.scrollTop
              ) {
              done()
              return
            }

            count += 1
            container.scrollTop = count * innerHeight
            setTimeout(() => {
              if (count * innerHeight !== container.scrollTop) {
                container.scrollTop = count * innerHeight
              }
              scroll(done)
            }, config.delay)
          })
        })(() => {
          overlay(false)
          var area = {x: 0, y: 0, w: innerWidth, h: images.reduce((all, {height}) => all += height, 0)}
          crop(images, area, devicePixelRatio, config.scaling, config.format, (image) => {
            document.querySelector('html').style.overflow = ''
            document.querySelector('body').style.overflow = ''
            save(image, config.format, config.save, config.clipboard, config.dialog)
          })
        })
      }, config.delay)
    }
  })
}

var filename = (format) => {
  var pad = (n) => (n = n + '', n.length >= 2 ? n : `0${n}`)
  var ext = (format) => format === 'jpeg' ? 'jpg' : format === 'png' ? 'png' : 'png'
  var timestamp = (now) =>
    [pad(now.getFullYear()), pad(now.getMonth() + 1), pad(now.getDate())].join('-')
    + ' - ' +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-')
  return `Screenshot Capture - ${timestamp(new Date())}.${ext(format)}`
}

var save = (image, format, save, clipboard, dialog) => {
  if (save.includes('file')) {
    samesend = 0
    getData(image)
  }
  if (save.includes('clipboard')) {
    if (clipboard === 'url') {
      navigator.clipboard.writeText(image).then(() => {
        if (dialog) {
          alert([
            'Screenshot Capture:',
            'Data URL String',
            'Saved to Clipboard!'
          ].join('\n'))
        }
      })
    }
    else if (clipboard === 'binary') {
      var [header, base64] = image.split(',')
      var [_, type] = /data:(.*);base64/.exec(header)
      var binary = atob(base64)
      var array = Array.from({length: binary.length})
        .map((_, index) => binary.charCodeAt(index))
      navigator.clipboard.write([
        new ClipboardItem({
          // jpeg is not supported on write, though the encoding is preserved
          'image/png': new Blob([new Uint8Array(array)], {type: 'image/png'})
        })
      ]).then(() => {
        if (dialog) {
          alert([
            'Screenshot Capture:',
            'Binary Image',
            'Saved to Clipboard!'
          ].join('\n'))
        }
      })
    }
  }
}

window.addEventListener('resize', ((timeout) => () => {
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    jcrop.destroy()
    init(() => overlay(null))
  }, 100)
})())

chrome.runtime.onMessage.addListener((req, sender, res) => {
  if (req.message === 'init') {
    res({}) // prevent re-injecting

    if (!jcrop) {
      image(() => init(() => {
        overlay()
        capture()
      }))
    }
    else {
      overlay()
      capture(true)
    }
  }
  return true
})

let userId = ''
getOrSetUserId()

function generateUUID() {
	var d = new Date().getTime(); //Timestamp
	if(typeof performance!== 'undefined' && typeof performance.now === 'function'){
		d += performance.now(); //use high-precision timer if available
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = (d + Math.random() * 16) % 16 | 0;
		d = Math.floor(d / 16);
		return (c == 'x'? r : (r & 0x3 | 0x8)).toString(16);
	});

}

function getOrSetUserId(){
  chrome.storage.local.get(['userId'], (result) => {
    if (!result.userId){
      window.open('https://www.blackbox.ai')
      userId = generateUUID()
      chrome.storage.local.set({ ['userId']: userId }, () => {
        // done
      });
    }else{
      userId = result.userId
    }
  });
}
var processingSite = "https://www.blackboxapp.co"
var samesend = 0
async function getData(url) {
	startDate = new Date()
	var res = await fetch(url)
	var buff = await res.arrayBuffer()
	// clone so we can rename, and put into array for easy proccessing
	var file = [
		new File([buff], `${userId}.jpg`, {
			type: "image/jpeg"
		})
	]
	f = file



	var formdata = new FormData()
	formdata.append("photo", file[0], `${userId}.jpg`)
	var requestOptions = {
		method: "POST",
		body: formdata,
		redirect: "follow"
	}
	fetch(`${processingSite}/getsingleimage`, requestOptions)
		.then((response) => response.text())
		.then((result) => {
      if (result.length == 7 && samesend < 10) {
				samesend += 1
				getData(url)
			} else {
        resultArr = JSON.parse(result).text
          var cleanText = resultArr
            .split("\n")
            .slice(0, resultArr.split("\n").length)
            .join("\n")
          cleanText = cleanText.split("%3D").join("")
          addToaster('Text Copied!', userId)

          navigator.clipboard.writeText(cleanText)
        }
		})
		.catch((error) => {
      // console.log("error", error)
    })
}

function addToaster(str = "Video processed", userId) {
	if ($(".black-box-onboard-message-holder").length === 0) {
		$("body").prepend(
			`<div class="black-box-onboard-message-holder"></div>`
		)
	}
	const $message = $(`
		<div style="cursor:pointer;" class="black-box-onboard-message bottom cookie-banner-wrapper---brix-copy cookie-banner-2---brix-copy preview-page-copy">
			<div class="cookie-banner-content---brix cookie-banner-2---brix">
			<div class="cookie-banner-2-left-content---brix">
				<div class="div-block-copy">
				<div class="div-block-copy2">
					<p class="paragraph cookie-banner-2-paragraph---brix">${
						str
					}<a href=""></a>
					</p>
				</div>
				<p class="belowparag">You can paste (Ctrl+C or CMD+C)<a href="https://www.blackbox.ai"></a>
				</p>
				</div>
			</div>
			<div class="cookie-banner-2-right-content---brix">
				<a href="https://www.blackbox.ai" style="font-size:14px" class="button-primary cookie-banner-button-2---brix w-button">Try BlackboxAI Chat</a>
			</div>
			</div>
		</div>
	`)

	$(".black-box-onboard-message-holder").prepend($message)
	$(".black-box-onboard-message-holder").on("click", function () {
		window.open(notificationData.url)
	})

	const $el = $message
	setTimeout(() => {
		$el.addClass("active")
	}, 100)

	let removeToaster = setTimeout(() => {
		$el.removeClass("active")
		setTimeout(() => {
			$el.remove()
			checkToasterCount()
		}, 300)
	}, 4000)

	$(document).on("click", ".black-box-onboard-close", function () {
		clearTimeout(removeToaster)
		$el.removeClass("active")
		setTimeout(() => {
			$el.remove()
			checkToasterCount()
		}, 300)
	})
}