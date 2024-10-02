/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-disable import/extensions */
import { closePopup, sendMessageWithNoResponse } from "../utils.js";

async function openURL(url) {
  sendMessageWithNoResponse({ command: "openTab", urlToOpen: url });
  closePopup();
}

export default class InlineLinkButton extends HTMLElement {
  async connectedCallback() {
    const { url } = this.dataset;
    const actionButton = document.createElement("button");

    actionButton.innerText = this.innerText;
    actionButton.addEventListener("click", openURL.bind(null, url));

    this.firstChild.replaceWith(actionButton);
  }
}
