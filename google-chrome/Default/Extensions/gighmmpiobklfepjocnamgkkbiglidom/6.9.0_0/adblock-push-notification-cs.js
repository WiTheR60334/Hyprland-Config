/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 324:
/***/ (function() {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const addDenyPushNotificationScript = function () {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const scriptElem = document.createElement("script");
            scriptElem.type = "module";
            scriptElem.src = browser.runtime.getURL("adblock-deny-push-notifications-requests.js");
            (document.head || document.documentElement).appendChild(scriptElem);
        }
        catch (err) {
            console.error(err);
        }
    });
};
addDenyPushNotificationScript();


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__[324]();
/******/ 	
/******/ })()
;