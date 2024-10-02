/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// CONCATENATED MODULE: ./src/premium-push-notification/content/notification.types.ts
const DefaultNotificationPermission = "default";
const DeniedNotificationPermission = "denied";
const GrantedNotificationPermission = "granted";

;// CONCATENATED MODULE: ./src/premium-push-notification/content/deny-notifications-requests.ts

const denyNotificationsRequests = function () {
    window.Notification.requestPermission = function () {
        return new Promise((resolve) => {
            resolve(window.Notification.permission === DefaultNotificationPermission
                ? GrantedNotificationPermission
                : DeniedNotificationPermission);
        });
    };
};
denyNotificationsRequests();

/******/ })()
;