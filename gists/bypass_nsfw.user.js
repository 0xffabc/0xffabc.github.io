// ==UserScript==
// @name         NSFW Bypass
// @namespace    http://tampermonkey.net/
// @version      2024-01-02
// @author       0xffabc
// @match        *://discord.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discord.com
// @grant        none
// @run-at       document-start
// ==/UserScript==

const props = ["nsfwAgree", "nsfwAllowed"];

/** How to get updated property for NSFW bypass:
  * 1. Hook "id" and "token" props and print out every "this"
  * 2. It should have a field e.g nsfwAllowed or nsfwAgree
**/

for (const property of props) 
  Object.defineProperty(Object.prototype, {
    __proto__: null, /** Terminate hook detection via adding hasOwnProperty **/
    get() {
      return true;
    }, set(value) {
      /** Uncomment the line below to print DiscordUser instances **/
      // console.log(this);
    }
  });
