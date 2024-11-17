// ==UserScript==
// @name         Dark shardscape
// @author       MVA // @0xjsc
// @version      0.4
// @match        *://*.moomoo.io/*
// @match        *://*.mohmoh.eu/*
// @match        *://mohmoh-vanilla.onrender.com/*
// @run-at       document-start
// ==/UserScript==

/**
 * Dark Shardscape
 * Made by 0xffabc, ueheua, yurio0001, daxours
 * Tested by qwains, emre, awsd, onanist, faze, yurio0001
 *
 * Devlog
 * 0.1 - Ported 1.8.0 mod bundle on mohmoh
 * 0.2 - added basic menu, fixed bugs
 * 0.3 - added antibull, improved healing, fixed prediction bugs, improved hitting and acc/hat changers
 * 0.4 - fixed bugs, redesigned menu
0.5 (in development, 26/29 chores finished):
- Fix autoheal dying to nonsence (not enough healing) - probably related to dmgpot overheal
- Add antisync - check dmgpot damage for every player that can hit you
- Improve bulltick - call it when the shame is more than 1 and next heal won't reset the shame
- Improve player coords predictions
- Finish up with angles
- Add auto spiketick
- Add authentication system and script leak defence
- Add visuals
- Improve instakills system
- Finish preplace (at least 2-3 times a tick)
- Barbarain armor instead of biome gears in autobreak - add a new condition for bounce guy
- Add anti autopush - move by tangent of trap
- Add placements queue, optimise autoplace and backgroundly sent packets
- Improve precision of `isReloaded` to work on every ping
- Speed up preplace to 3 times a tick in order to outplace ≥37ms (hop from ≥55ms + pps issues)
- Improve dmgpot logic (first hit - qhold, second - reset) so it wont shame much (minimum bulltick usage is important)
- Optimise placers
- Make preplace run between 2 ticks, decide when the object will be broken - in end of first tick or start of second tick, and spam in that half - improves preplace to outplacing ≥18ms
- Add building health visual
- Improve next player hit prediction on higher ping
- Heavily optimise placers
- Separate rendering to different requestAnimationFrame
- Fix visuals being jagged
- Fix hat changer on primary not changing on first hit
- Perfect out automills
- Fix visuals being jagged on high distances
**/

localStorage.removeItem("__frvr_analytics_storage");
localStorage.removeItem("__frvr_rfc_uuidv4");
try { localStorage.removeItem(Object.keys(localStorage).find(e => /deviceSignal/gm.test(e))) } catch(e) {};

function clearCookies(_) {
  const baseDomain = location.hostname
    .split(/\.(?=[^\.]+\.)/)
    .reduceRight((acc, part, idx, arr) => idx ? `.${part}${acc}` : acc, "");

  document.cookie = `${_}=;max-age=0;path=/;domain=${baseDomain}`;
};

document.cookie.replace(/(?<=^|;)([^=]+)(?=\=|;|$)/gm, clearCookies);

let _ = setInterval(() => {
  if (document.querySelector("#altcha_checkbox") && document.querySelector("#loadingText").style.display == "none") {
    clearInterval(_);
    document.querySelector("#altcha_checkbox").click();
  }
}, 100);

let lastUpd = 0;
let camX = 0, camY = 0;

CanvasRenderingContext2D.prototype.strokeText_ = CanvasRenderingContext2D.prototype.strokeText;
CanvasRenderingContext2D.prototype.strokeText = new Proxy(CanvasRenderingContext2D.prototype.strokeText, {
  __proto__: null,
  apply(target, _this, args) {
    if (player && args[0].includes(player?.name)) {
      _this.save();
      _this.beginPath();
      const txt = packetsCount + " " + (~~(packetsCount / 9));
      _this.fillStyle = "white";
      _this.font = "20px Hammersmith One";
      _this.strokeText_(txt, args[1], args[2] + 170);
      _this.fillText(txt, args[1], args[2] + 170);
      _this.restore();
      _this.closePath();

      animate(_this);
    }
    return target.call(_this, ...args);
  }
});

CanvasRenderingContext2D.prototype.lineTo = new Proxy(CanvasRenderingContext2D.prototype.lineTo, {
  __proto__: null,
  apply(target, that, args) {
    if (that.globalAlpha == 0.06 && !configurer.showGrid) return;

    return target.apply(that, args);
  }
})

function animate(ctx) {
  if (!player) return;

  const deltat = Date.now() - lastUpd;
  const tmpDist = Math.hypot(camX - player.x, camY - player.y);
  const tmpDir = Math.atan2(player.y - camY, player.x - camX);
  const camSpd = Math.min(tmpDist * 0.01 * deltat, tmpDist);

  for (const player_ of players) {
    player.dt += deltat;

    let tmpDiff = player_.x2 - (player_.x1 || player.x2);
    let tmpRate = Math.min(1.7, player_.dt / 170);

    player_.x = (player_.x1 || player.x2) + tmpDiff * tmpRate;
    tmpDiff = player_.y2 - (player_.y1 || player.y2);
    player_.y = (player_.y1 || player.y2) + tmpDiff * tmpRate;
  }

  lastUpd = Date.now();

  if (tmpDist > 100) {
    camX = player.x;
    camY = player.y;
  } else {
    camX += camSpd * Math.cos(tmpDir);
    camY += camSpd * Math.sin(tmpDir);
  }

  let yOffset = camY - config.maxScreenHeight / 2;
  let xOffset = camX - config.maxScreenWidth / 2;

  for (const obj of placedThisTick) {
    if (!configurer.doPredictPlace) continue;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.arc(obj.x - xOffset, obj.y - yOffset, obj.scale, 0, 6.3);
    ctx.stroke();
    ctx.closePath();
  }

  if (configurer.doBuildingHp) {
    for (const obj of nearestGameObjects) {
      if (Math.abs(player.x3 - obj.x) + Math.abs(player.y3 - obj.y) > 300 || isNaN(+obj.health)) continue;
      const dx = obj.x - xOffset;
      const dy = obj.y - yOffset;

      const font = "" + ctx.font;
      ctx.font = ctx.font.replace(/(\d\d)px/gm, "20px");
      ctx.strokeText_(Math.trunc(obj.health / obj.maxHealth * 100) + "%", dx, dy);
      ctx.fillText(Math.trunc(obj.health / obj.maxHealth * 100) + "%", dx, dy);
      ctx.font = font;
    }
  }
};

const elShadow = document.createElement("div");
elShadow.style = "background: rgba(0, 0, 40, 0.3); width: 100%; height: 100%; position: fixed; top: 0; left: 0; pointer-events: none; z-index: 10";
document.documentElement.appendChild(elShadow);

let temp$ = Symbol("append");

Object.assign = new Proxy(Object.assign, {
  __proto__: null,
  apply(targetObj, thisObj, argsArr) {
    if (argsArr[0]?.signal) argsArr[0].mode = "no-cors";

    return targetObj.apply(thisObj, argsArr);
  }
});

Object.defineProperty(Object.prototype, "append", {
  get() {
    return this[temp$];
  }, set(func) {
    if (func.toString().includes("appendChild")) {
      return (this[temp$] = function () {
        throw new Error("ez fucked");
      });
    } else return (this[temp$] = func);
  }
});

Object.defineProperty(window, "FRVR", {
  value: {
    ads: {
      show: async function show() { }
    },
    tracker: {
      levelStart: () => {}
    },
    bootstrapper: {
      complete: () => {},
      init() {
        return new Promise(_ => {
          _();
        })
      }
    }, channelCharacteristics: {
      allowNavigation: true
    }
  }, writable: false
})

class CoreEncode {
  buffer = [];
  view = new DataView(new ArrayBuffer(8));

  write(...bytes) {
    this.buffer.push(...bytes);
  }

  start_arr(len) {
    if (len > 15 && len < 65535) {
      this.write(0xdc, len >>> 8, len);
    } else if (len < 15)
      this.write(0x90 + len);
    else {
      this.write(0xdd, len >>> 24, len >>> 16, len >>> 8, len);
    }

    return this;
  }

  fixstr(str) {
    const strenc = str.split("").map(_ => _.charCodeAt(0));
    if (strenc.length <= 31) {
      return this.write(0xa0 + strenc.length, ...strenc);
    } else if (strenc.length < 255) {
      this.write(0xd9, strenc.length, ...strenc);
    } else if (strenc.length < 65535) {
      this.write(0xda, strenc.length >>> 8, strenc.length, ...strenc);
    } else if (strenc.length < 4294967295) {
      this.write(0xdb, strenc.length >>> 24, strenc.length >>> 16, strenc.length >>> 8, strenc.length, ...strenc);
    }

    return this;
  }

  map(length) {
    if (length > 15 && length < 65535) {
      this.write(0xde, length >>> 8, length);
    } else if (length < 15)
      this.write(0x80 + length);
    else {
      this.write(0xdf, length >>> 24, length >>> 16, length >>> 8, length);
    }

    return this;
  }

  add_num(num) {
    if (typeof num == "bigint") num = Number(num);
    if (!Number.isInteger(num)) {
      this.view.setFloat64(0, num);

      this.write(0xcb, ...new Uint8Array(this.view.buffer));

      return this;
    }

    if (num == 0) this.write(0);
    else if (num > 0) {
      if (num < 127) {
        this.write(num);
      } else if (num < 256) {
        this.write(0xcc, num);
      } else if (num < 65535) {
        this.write(0xcd, num >>> 8, num);
        } else if (num < 4294967296) {
          this.write(0xce, num >>> 24, num >>> 16, num >>> 8, num);
        } else if (num <= 18446744073709552000) {
          let h = num / 4294967296, l = num % 4294967296;
          this.write(0xcf, h >>> 24, h >>> 16, h >>> 8, h, l >>> 24, l >>> 16, l >>> 8, l);
        } else this.write(0xcf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff);
      } else {
      if (num > -128) {
        this.write(0xd0, num);
      } else if (num > -32768) {
        this.write(0xd1, num >>> 8, num);
      } else if (num > -4294967296) {
          this.write(0xd2, num >>> 24, num >>> 16, num >>> 8, num);
        } else if (num >= -18446744073709552000) {
          let h = num / 4294967296, l = num % 4294967296;
          this.write(0xd3, h >>> 24, h >>> 16, h >>> 8, h, l >>> 24, l >>> 16, l >>> 8, l);
        } else this.write(0xd3, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
    }

    return this;
  }

  encode(data, noReset) {
    if (!noReset) this.buffer.length = 0;
    if (data?.constructor?.name == "Array") {
      this.start_arr(data.length);
      for (let i = 0; i < data.length; i++) this.encode(data[i], true);
    } else if (typeof data == "object" && !!data) {
      const keys = Object.keys(data);
      this.map(keys.length);

      for (let i = 0; i < keys.length; i++) {
        this.encode(keys[i], true);
        this.encode(data[keys[i]], true);
      }
    } else if (typeof data == "string") this.fixstr(data);
    else if (typeof data == "number" || typeof data == "bigint") this.add_num(data);
    else if (typeof data == "boolean") this.write(data ? 0xC3 : 0xC2);
    else if (typeof data == "undefined" || isNaN(data) || data == null) this.write(0xc0);

    return this.buffer;
  }
}

class CoreDecode {
  buffer = [];
  offset = 0;

  readByte() {
    return this.buffer[this.offset++];
  }

  readBytes(amount) {
    return this.buffer.slice(this.offset, this.offset += amount);
  }

  skip(amount) {
    this.offset += amount;
  }

  decode(buff) {
    if (buff) {
      this.buffer = buff;
      this.view = new DataView(new Uint8Array(this.buffer).buffer);
      this.offset = 0;
    }

    const byte = this.readByte();
    if (byte >= 0xa0 && byte <= 0xbf) {
      const length = byte - 0xa0;
      return String.fromCharCode(...this.readBytes(length));
    } else if (byte == 0xd9) {
      return String.fromCharCode(...this.readBytes(this.readByte()));
    } else if (byte == 0xda) {
      return String.fromCharCode(...this.readBytes(this.readByte() << 8 | this.readByte()));
    } else if (byte == 0xdb) {
      return String.fromCharCode(...this.readBytes(this.readByte() >>> 24 | this.readByte() >>> 16 | this.readByte() >>> 8 | this.readByte()));
    } else if ((byte >= 0x90 && byte <= 0x9f) || byte == 0xdc || byte == 0xdd) {
      const length = byte == 0xdc ? (this.readByte() << 8 | this.readByte()) : byte == 0xdd ? (this.readByte() >>> 24 | this.readByte() >>> 16 | this.readByte() >>> 8 | this.readByte()) : byte - 0x90;
      const array = [];
      for (let i = 0; i < length; i++) {
        array.push(this.decode());
      }
      return array;
    } else if ((byte >= 0x80 && byte <= 0x8f) || byte == 0xde || byte == 0xdf) {
      const length = byte == 0xde ? (this.readByte() << 8 | this.readByte()) : byte == 0xdf ? (this.readByte() >>> 24 | this.readByte() >>> 16 | this.readByte() >>> 8 | this.readByte()) : byte - 0x80;
      const map = {};
      for (let i = 0; i < length; i++) {
        const key = this.decode();
        const value = this.decode();
        if (key != "__proto__") map[key] = value;
      }
      return map;
    } else if (byte > 0 && byte < 0x7f) {
      return byte;
    } else if (byte == 0xcc) {
      return this.readByte();
    } else if (byte == 0xcd) {
      return this.readByte() << 8 | this.readByte();
    } else if (byte == 0xce) {
      return this.readByte() << 24 | this.readByte() << 16 | this.readByte() << 8 | this.readByte();
    } else if (byte == 0xcf) {
      return BigInt(this.readByte()) << 8n | BigInt(this.readByte()) << 16n | BigInt(this.readByte()) << 24n | BigInt(this.readByte()) << 32n | BigInt(this.readByte()) << 40n | BigInt(this.readByte()) << 48n | BigInt(this.readByte()) << 56n | BigInt(this.readByte()) << 64n;
    } else if (byte >= 0xe0 && byte <= 0xff) {
      return 0xff - byte - 1;
    } else if (byte == 0xd0) {
      return this.readByte() - 256;
    } else if (byte == 0xd1) {
      return -(this.readByte() << 8 | this.readByte());
    } else if (byte == 0xd2) {
      return -(this.readByte() << 24 | this.readByte() << 16 | this.readByte() << 8 | this.readByte());
    } else if (byte == 0xd3) {
      return (0n | BigInt(this.readByte()) << 8n | BigInt(this.readByte()) << 16n | BigInt(this.readByte()) << 24n | BigInt(this.readByte()) << 32n | BigInt(this.readByte()) << 40n | BigInt(this.readByte()) << 48n | BigInt(this.readByte()) << 56n | BigInt(this.readByte()) << 64n) * (-1n);
    } else if (byte == 0xcb) {
      const res = this.view.getFloat64(this.offset);
      this.skip(8);
      return res;
    } else if (byte == 0xc3) return true;
    else if (byte == 0xc2) return false;
    else if (byte == 0xc0) return null;
    else return byte;
  }
}

const encoder = new CoreEncode();
const decoder = new CoreDecode();

const msgpack = window.msgpack = {
  pack(data) {
    return new Promise((accept, reject) => {
      try {
        accept(this._encode(data));
      } catch(e) {
        reject(e);
      }
    })
  },
  unpack(buffer) {
    return new Promise((accept, reject) => {
      try {
        accept(this._decode(buffer));
      } catch(e) {
        reject(e);
      }
    });
  },
  encode: encoder.encode.bind(encoder),
  decode: decoder.decode.bind(decoder)
};

let sheduleHits_ = [];
const sheduleHits = {
  addHit(force) {
    packet("F", true, getAttackDir());
    packet("F", false, getAttackDir());
  },
  push(ticksFromThis) {
    sheduleHits_.push(game.tick + ticksFromThis);
  }
};

let notifOffset = 0;
let predictPlace = [];

function notification(text) {
  const notif = document.createElement("div");
  notif.style = "width: 300px; height: 50px; background: rgb(30, 30, 30); position: fixed; top: 0; right: -300px; border-bottom: 4px solid white; color: white; text-align: center; z-index: 999";
  notif.innerHTML = `<div style = "transform: translate(0%, 55%); font-size: 20px"> ${text} </div>`;
  notif.style.top = notifOffset + "px";
  notif.className = "sigittariusNotif";
  notifOffset += 75;
  setTimeout(() => {
    notifOffset -= 75;
    notif.remove();
  }, 3000);
  document.documentElement.appendChild(notif);
}

const client_menu = document.createElement("div");
client_menu.style = ["position: fixed", "color: rgba(255, 255, 255, 0.2)", "width: 700px", "height: 600px", "z-index: 10000", "top: 0%", "left: 0%", "font-weight: slim", "font-size: 12px", "font-family: monospace !important", "scrollbar-color: #1d1d1d transparent", "word-break: break-all", ].join(";");
client_menu.innerHTML = `
       <header style = "text-align: center; font-size: 20px; width: 100%; background-color: rgb(20, 20, 50); border-top-right-radius: 20px; border-top-left-radius: 20px; z-index: 999; height: 50px; ">
           <img src = "https://i.ibb.co/cyTb2d0/image.png" style = "width: 50px; height: 50px; border-radius: 50px; position: absolute; top: 0%; left: 5%; opacity: 50%"> Dark shardscape
           <button onclick = "this.parentElement.parentElement.style.display = 'none'" style = "width: 7.5%; height: 50px; position: absolute; pointer-events: all; right: 0; border-top-right-radius: 20px; border: 0; font-size: 30px; background-color: rgb(75, 20, 20);"> X </button>
       </header>
       <style>
       @keyframes bgsmooth {
         0% {
           background-color: rgb(30, 30, 30);
           border-bottom: 2px solid rgb(60, 60, 60);
         },
         100% {
           background-color: rgb(20, 20, 20);
           border-bottom: 2px solid rgb(30, 30, 30);
         }
       }
       @keyframes bgsmoothout {
         100% {
           background-color: rgb(20, 20, 30);
           border-bottom: 2px solid rgb(20, 20, 20);
         },
         0% {
           background-color: rgb(30, 30, 30);
           border-bottom: 2px solid rgb(20, 20, 20);
         }
       }
       .block_ {
         background-color: rgb(15, 15, 30);
         width: 100%;
         height: 10%;
         text-align: center;
         border-bottom: 2px solid rgb(10, 10, 30);
         animation: bgsmoothout 0.5s;
       }
       .block_:hover {
         background-color: rgb(60, 60, 120);
         border-bottom: 2px solid rgb(30, 30, 30);
         animation: bgsmooth 0.5s;
       }
       span:hover {
         animation: bgsmooth 0.5s;
       }
       input[type=range] {
           height: 17px;
           -webkit-appearance: none;
           margin: 10px 0;
           width: 100%;
           border-radius: 0;
           background-color: #000000;
           color: white;
           outline: none;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          background-color: rgb(50, 50, 50);
          width: 17px;
          height: 17px;
        }
        input[type=button] {
          filter: invert(1);
          color: rgb(200, 200, 200);
          border: 0;
        }
        input[type=button]:hover {
          color: rgb(20, 20, 20);
        }
       </style>
       <section style = "display: flex; width: 21%; height: 83.5%; pointer-events: all; position: absolute; top: 50px; bottom: 0; background-color: rgb(10, 10, 30); border-bottom-left-radius: 20px; font-size: 20px; text-align: center; flex-direction: column;">
          <block class = "block_" onclick = "Array.from(document.querySelectorAll('column'), e => e.style.display = 'none'); document.querySelector('#column').style.display = 'block'">
            <div style = "transform: translateY(100%); position: absolute; left: 30%; font-size: 15px"> Combat </div>
          </block>
          <block class = "block_" onclick = "Array.from(document.querySelectorAll('column'), e => e.style.display = 'none'); document.querySelector('#column1').style.display = 'block'">
             <div style = "transform: translateY(100%); position: absolute; left: 30%; font-size: 15px"> Defence </div>
          </block>
          <block class = "block_" onclick = "Array.from(document.querySelectorAll('column'), e => e.style.display = 'none'); document.querySelector('#column3').style.display = 'block'">
             <div style = "transform: translateY(100%); position: absolute; left: 30%; font-size: 15px"> Autos </div>
          </block>
          <block class = "block_" onclick = "Array.from(document.querySelectorAll('column'), e => e.style.display = 'none'); document.querySelector('#column4').style.display = 'block'">
             <div style = "transform: translateY(100%); position: absolute; left: 30%; font-size: 15px"> Render </div>
          </block>
          <block class = "block_" onclick = "Array.from(document.querySelectorAll('column'), e => e.style.display = 'none'); document.querySelector('#column5').style.display = 'block'">
             <div style = "transform: translateY(100%); position: absolute; left: 30%; font-size: 15px"> Songs </div>
          </block>
          <block class = "block_" onclick = "Array.from(document.querySelectorAll('column'), e => e.style.display = 'none'); document.querySelector('#column6').style.display = 'block'">
             <div style = "transform: translateY(100%); position: absolute; left: 30%; font-size: 15px"> Rage bot </div>
          </block>
       </section>
       <div id = "text" style = "height: 83.5%; width: 80%; background-color: rgb(10, 10, 20); position: absolute; right: 0; pointer-events: all; touch-events: all; border-bottom-right-radius: 20px; overflow: auto">
         <column id = "column"> </column>
         <column id = "column1"> </column>
         <column id = "column3"> </column>
         <column id = "column4"> </column>
         <column id = "column5">
           <h2> Dark shardscape offers the best lyrics system every mod can reach </h2>
         </column>
         <column id = "column6">
           <h2> These features may be more packet consuming, but they are useful when punishing naziboys </h2>
         </column>
       </div>
    `;
class Prompt {

  constructor(message, callback) {
    const randomID = crypto.randomUUID().replaceAll("-", "");
    const btnId = crypto.randomUUID();

    document.documentElement.insertAdjacentHTML("beforeend", `
    <ma${randomID}ta style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%)">
      ${message} <input type = "name"> <button id = "${btnId}"> Enter </button>
    </ma${randomID}ta>
    `);

    document.getElementById(btnId).addEventListener("click", event => {
      callback(document.getElementById(btnId).parentElement.querySelector("input").value);
      document.getElementById(btnId).parentElement.remove();
    });
  }

}
let globalLyrics = [];
window.fetchLyrics = async function(_) {
  open(`https://api.textyl.co/api/lyrics?q=${encodeURIComponent(_)}`, "lyrics", "width=300,height=300").onunload = function() {
    new Prompt("Enter lyrics shown: ", _ => {
      globalLyrics = [];
      const lyrics = JSON.parse(_);
      lyrics.forEach(e => setTimeout(() => packet("6", e.lyrics.substring(0, 30)), e.seconds * 1000 - pingTime / 2));
      notification("Playing " + _);
    })
  };
}
client_menu.id = "console_";
client_menu.style.userSelect = "none";
client_menu.draggable = true;
document.documentElement.appendChild(client_menu);
Array.from(document.querySelectorAll("column"), e => e.style.display = "none");
let offsetX = 0;
let offsetY = 0;
client_menu.addEventListener("dragstart", e => {
  const elementX = parseInt(client_menu.style.left);
  const elementY = parseInt(client_menu.style.top);
  offsetX = elementX - e.clientX;
  offsetY = elementY - e.clientY;
});
client_menu.addEventListener("dragend", e => {
  client_menu.style.top = e.clientY + offsetY + "px";
  client_menu.style.left = e.clientX + offsetX + "px";
});
const configurer = {
  doPrePlace: location.host.includes("mohmoh"),
  doAutoHold: true,
  doFastSwitch: true,
  doRV3Night: true,
  doAntiSync: true,
  doPingHeal: true,
  doAntiPush: true,
  doWeaponGrind: false,
  doSafeAntiSpikeTick: true,
  doNoBullInsta: false,
  doPlaceIndicator: true,
  doTurretCombatAssistance: true,
  usePredictions: false,
  doKillChat: true,
  doAutoBuy: true,
  doAutoBuyEquip: true,
  doAutoBreakSpike: false,
  showGrid: true,
  doAutoPush: true,
  doRevTick: true,
  doSpikeTick: true,
  doPredictTick: true,
  doAutoPlace: true,
  doAutoReplace: true,
  doAntiTrap: true,
  doSlowOT: false,
  doAttackDir: false,
  doBuildingHp: true,
  doStackDamage: false,
  doHideText: false,
  doHideDataMenu: true,
  doAutoBullSpam: true,
  doBuildingHitText: false,
  doPredictPlace: true,
  doNameTags: true,
  do360Hit: location.host.includes("mohmoh"),
  darkness_: true,
  set disableDarkness(val) {
    if (val) {
      this.darkness_ = true;
      elShadow.style.background = "rgba(0, 0, 0, 0.3)";
    } else {
      this.darkness_ = false;
      elShadow.style.background = "transparent";
    }
  }, get disableDarkness() {
    return this.darkness_;
  }
};
class Toggle {
  constructor(column, name, option, description) {
    this.toggleElement = document.createElement("input");
    this.toggleText = document.createElement("label");
    this.lineSeparator = document.createElement("br");
    this.toggleText.style = "display: inline-block; width: 97.5%; height: 60px; background: rgba(0, 0, 0, 0.4); border-radius: 15px; font-size: 20px; margin-top: 3px; color: rgb(120, 120, 120); padding: 6px";
    this.toggleText.className = "sigittariusFeature";
    this.toggleElement.type = "checkbox";
    this.toggleElement.style.visibility = "hidden";
    this.toggleElement.checked = configurer[option];
    this.toggleText.style.color = this.toggleElement.checked ? "#aaa" : "rgb(120, 120, 120)";
    this.toggleElement.onchange = () => {
      configurer[option] = !configurer[option];
      this.toggleText.style.color = this.toggleText.style.color == "rgb(120, 120, 120)" ? "#aaa" : "rgb(120, 120, 120)";
    }
    this.toggleText.innerHTML = name + "<br>" + "<div style = 'filter: darken(1)'>" + description + "</div>";
    document.getElementById(column).appendChild(this.toggleText);
    document.getElementById(column).appendChild(this.lineSeparator);
    this.toggleText.appendChild(this.toggleElement);
  }
}

class Descriptor {
  constructor(column, name, option, description) {
    this.toggleElement = document.createElement("input");
    this.toggleText = document.createElement("label");
    this.lineSeparator = document.createElement("br");
    this.toggleText.style = "display: inline-block; width: 97.5%; height: auto; background: rgba(0, 0, 0, 0.4); border-radius: 15px; font-size: 20px; margin-top: 3px; color: rgb(120, 120, 120); padding: 6px";
    this.toggleText.className = "sigittariusFeature";
    this.toggleElement.type = "checkbox";
    this.toggleElement.style.visibility = "hidden";
    this.toggleElement.onchange = () => {
      configurer[option] = !configurer[option];
      this.toggleText.style.color = this.toggleText.style.color == "rgb(120, 120, 120)" ? "#aaa" : "rgb(120, 120, 120)";
    }
    this.toggleText.innerHTML = name + "<br>" + "<div style = 'filter: darken(1)'>" + description + "</div>";
    document.getElementById(column).appendChild(this.toggleText);
    document.getElementById(column).appendChild(this.lineSeparator);
    this.toggleText.appendChild(this.toggleElement);
  }
}

new Toggle("column", "Fast hats", "doFastSwitch", "Exploit that allows you to switch to soldier as fast as you can");
new Toggle("column", "360 Aim / Hit", "do360Hit", "Exploits that allows your to hit everywhere around");
new Toggle("column", "No bull insta", "doNoBullInsta", "Fools antiinsta of enemy by cost of damage");
new Toggle("column", "Turret gear assistance", "doTurretCombatAssistance", "Uses turret for antibull");
new Toggle("column", "Revival 3 tick", "doRevTick", "Inverses oneticks, may decrease damage");
new Toggle("column", "Spiketick", "doSpikeTick", "Checks if a hit can be synced with spike damage");
new Toggle("column", "Predict ticks", "doPredictTick", "Predicts next ticks and enemy positions");
new Toggle("column", "Dynamic onetick", "doSlowOT", "Always tries to do onetick");
new Toggle("column", "Use predictions", "usePredictions", "Predicts next players positions. USE THIS FEATURE ONLY ON PING >222MS.");
new Toggle("column1", "Anti push", "doAntiPush", "Tries to escape autopush");
new Toggle("column1", "Safe AntiSpikeTick", "doSafeAntiSpikeTick", "Uses soldier for anti spiketick");
new Toggle("column1", "Autobreak spike", "doAutoBreakSpike", "Breaks spikes");
new Toggle("column3", "Auto grind", "doWeaponGrind", "Helps to grind weapons faster");
new Toggle("column3", "PathBot", "pathy", "Use this if you have no keyboard");
new Toggle("column3", "Autopush", "doAutoPush", "Automatically pushes enemy to spikes");
new Toggle("column3", "Autobuy", "doAutoBuy", "Automatically buys hats and accessories");
new Toggle("column3", "Autoplace", "doAutoPlace", "Places traps / spikes around");
new Toggle("column3", "Autoreplace", "doAutoReplace", "Tries to replace trap or spike when its broken");
new Toggle("column4", "Disable dark mode", "disableDarkness", "Disables dark mode, in case if you want to brutally kill eyes");
new Toggle("column4", "Building health", "doBuildingHp", "Shows health of builds");
new Toggle("column4", "Predict place", "doPredictPlace", "Shows building that's placement is in progress or enqueued but not placed");
new Toggle("column4", "Show gridlines", "showGrid", "Shows native grids. Disable for better performance");
new Toggle("column4", "Disable rotations", "doDisableRot", "Disables every rotation in the game");
new Toggle("column4", "Visual autospin", "doVisualSpin", "Makes your player spin");
new Toggle("column4", "Client autospin", "doClientSpin", "Modifies artcangent function to make your player spin");
new Toggle("column4", "Packet autospin", "doPacketSpin", "Sends aim packet to make your player spin for others");
new Descriptor("column5", "Select song lyrics", "[NULL]", `Select song by name <input type = "name" id = "byname" value = "Kill me slow">
<button onclick = "window.fetchLyrics(document.getElementById('byname').value)" id = "fetcher"> Fetch and play lyrics </button>
<br>
Lyrics API is textyl.co`);
new Toggle("column6", "Constant soldier", "doConstaSoldier", "Always holds soldier to reduce damage as much as it can");
new Toggle("column6", "Preemptive preplace", "doAutoHold", "Automatically holds v and f on objects that will break. A bit gay.");
new Toggle("column6", "Autoinsta reset", "doResetInsta", "Unequips soldier when enemy is ready to insta and qholds the first hit. Ultra gay.");


CanvasRenderingContext2D.prototype.rotate = new Proxy(CanvasRenderingContext2D.prototype.rotate, {
  __proto__: null,
  apply(target, that, args) {
    if (configurer.doDisableRot) return;
    return target.apply(that, args);
  }
});

Math.atan2 = new Proxy(Math.atan2, {
  __proto__: null,
  apply(target, that, args) {
    if (configurer.doClientSpin && (new Error().stack.includes("bundle") || new Error().stack.includes("assets")) && (new Error().stack.includes("getAttackDir") || new Error().stack.includes("gr"))) return Math.cos(Date.now()) * 12;
    return target.apply(that, args);
  }
})

Object.defineProperty(Object.prototype, "dirPlus", {
  __proto__: null,
  get() {
    if (configurer.doVisualSpin && this.sid == playerSID) return Math.cos(Date.now()) * 12;
    return this._dirPlus;
  }, set(value) {
    this._dirPlus = value;
  }
});

const config = {
  "maxScreenWidth": 1920,
  "maxScreenHeight": 1080,
  "serverUpdateRate": 9,
  "maxPlayers": 40,
  "maxPlayersHard": 50,
  "collisionDepth": 6,
  "minimapRate": 3000,
  "colGrid": 10,
  "clientSendRate": 5,
  "healthBarWidth": 50,
  "healthBarPad": 4.5,
  "iconPadding": 15,
  "iconPad": 0.9,
  "deathFadeout": 3000,
  "crownIconScale": 60,
  "crownPad": 35,
  "chatCountdown": 3000,
  "chatCooldown": 500,
  "maxAge": 100,
  "gatherAngle": 1.208304866765305,
  "gatherWiggle": 10,
  "hitReturnRatio": 0.25,
  "hitAngle": 1.5707963267948966,
  "playerScale": 35,
  "playerSpeed": 0.0016,
  "playerDecel": 0.993,
  "nameY": 34,
  "skinColors": ["#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373"],
  "animalCount": 7,
  "aiTurnRandom": 0.06,
  "cowNames": ["Sid", "Steph", "Bmoe", "Romn", "Jononthecool", "Fiona", "Vince", "Nathan", "Nick", "Flappy", "Ronald", "Otis", "Pepe", "Mc Donald", "Theo",
    "Fabz", "Oliver", "Jeff", "Jimmy", "Helena", "Reaper", "Ben", "Alan", "Naomi", "XYZ", "Clever", "Jeremy", "Mike", "Destined", "Stallion", "Allison",
    "Meaty", "Sophia", "Vaja", "Joey", "Pendy", "Murdoch", "Theo", "Jared", "July", "Sonia", "Mel", "Dexter", "Quinn", "Milky"
  ],
  "shieldAngle": 1.0471975511965976,
  "weaponVariants": [{
    "id": 0,
    "src": "",
    "xp": 0,
    "val": 1
  }, {
    "id": 1,
    "src": "_g",
    "xp": 3000,
    "val": 1.1
  }, {
    "id": 2,
    "src": "_d",
    "xp": 7000,
    "val": 1.18
  }, {
    "id": 3,
    "src": "_r",
    "poison": true,
    "xp": 12000,
    "val": 1.18
  }, {
    "id": 4,
    "src": "_e",
    "poison": true,
    "xp": 15000,
    "val": 1.21
  }],
  "fetchVariant": function(t) {
    if (!t?.weaponXP) return config.weaponVariants[0];
    for (var n = t?.weaponXP[t?.weaponIndex] || 0, i = config.weaponVariants.length - 1; i >= 0; --i)
      if (n >= config.weaponVariants[i].xp)
         return config.weaponVariants[i]
  },
  "resourceTypes": ["wood", "food", "stone", "points"],
  "areaCount": 7,
  "treesPerArea": 9,
  "bushesPerArea": 3,
  "totalRocks": 32,
  "goldOres": 7,
  "riverWidth": 724,
  "riverPadding": 114,
  "waterCurrent": 0.0011,
  "waveSpeed": 0.0001,
  "waveMax": 1.6,
  "treeScales": [150, 160, 165, 175],
  "bushScales": [80, 85, 95],
  "rockScales": [80, 85, 90],
  "snowBiomeTop": 2400,
  "snowSpeed": 0.75,
  "maxNameLength": 15,
  "mapScale": 14400,
  "mapPingScale": 40,
  "mapPingTime": 2200,
  "volcanoScale": 320,
  "innerVolcanoScale": 100,
  "volcanoAnimalStrength": 2,
  "volcanoAnimationDuration": 3200,
  "volcanoAggressionRadius": 1440,
  "volcanoAggressionPercentage": 0.2,
  "volcanoDamagePerSecond": -1,
  "volcanoLocationX": 13960,
  "volcanoLocationY": 13960,
  "MAX_ATTACK": 0.6,
  "MAX_SPAWN_DELAY": 1,
  "MAX_SPEED": 0.3,
  "MAX_TURN_SPEED": 0.3,
  "DAY_INTERVAL": 1440000
};
const clientTranslate = new Map([
  ["P", "11"],
  ["Q", "12"],
  ["b", "10"],
  ["L", "8"],
  ["N", "9"],
  ["c", "13c"],
  ["6", "ch"],
  ["e", "rmd"],
  ["F", "c"],
  ["f", "33"],
  ["K", "7"],
  ["S", "14"],
  ["z", "5"],
  ["M", "sp"],
  ["H", "6"],
  ["D", "2"],
  ["0", "pp"]
]);
const serverTranslate = new Map([
  ["id", "A"],
  ["d", "B"],
  ["1", "C"],
  ["2", "D"],
  ["4", "E"],
  ["33", "a"],
  ["5", "G"],
  ["6", "H"],
  ["a", "I"],
  ["aa", "J"],
  ["7", "K"],
  ["8", "L"],
  ["sp", "M"],
  ["9", "N"],
  ["h", "O"],
  ["11", "P"],
  ["12", "Q"],
  ["13", "R"],
  ["14", "S"],
  ["15", "T"],
  ["16", "U"],
  ["17", "V"],
  ["18", "X"],
  ["19", "Y"],
  ["20", "Z"],
  ["ac", "g"],
  ["ad", "1"],
  ["an", "2"],
  ["st", "3"],
  ["sa", "4"],
  ["us", "5"],
  ["ch", "6"],
  ["mm", "7"],
  ["t", "8"],
  ["p", "9"],
  ["pp", "0"]
]);

document.documentElement.insertAdjacentHTML("beforeend", `
<style>
progress {
  height: 20px;
  width: 175px;
  border-radius: 0px;
}
.sigittariusNotif {
  animation: 1s infinite alternate sigittariusNotifPopup;
}

@keyframes sigittariusNotifPopup {
  from {
    right: -300px;
  }
  to {
    right: 0;
  }
}

#chatHolder {
  width: 500px;
  height: 300px;
  background: transparent;
  backdrop-filter: blur(5px);
  border-radius: 10px;
  position: fixed;
  top: 3%;
  left: 0.5%;
  text-align: start;
  overflow: auto;
  opacity: 30%;
  transition: all 1s;
}

#chatHolder:hover {
  opacity: 100%;
  background: rgba(0, 0, 0, 0.11);
}

.sigittariusFeature:hover {
  transform: scale(1);
}

.sigittariusFeature {
  transition: all 0.5s;
  transform: scale(0.97);
}

#chatHolder:focus-within {
  opacity: 100%;
  background: rgba(0, 0, 0, 0.11);
}

#chatBox {
  position: absolute;
  width: 97.5%;
  left: 0;
  bottom: 0;
  backdrop-filter: blur(5px);
  border-radius: 10px;
}

.menuCard {
  box-shadow: 0px 7px #888888;
  scrollbar-color: rgba(0, 0, 0, 0.5) rgba(0, 0, 0, 0.5);
  transition: all 1s;
}

.menuCard:hover {
  transform: scale(1.05);
}

#mainMenu, #linksContainer2, #linksContainer1 {
  background-color: none !important;
  background-image: none !important;
  backdrop-filter: none;
  border: 0px !important;
}

.menuCard {
  width: 325px !important;
  margin: 5px !important;
  padding: 20px !important;
  border: 0px !important;
}

#wideAdCard, .adMenuCard, #promoImgHolder, #main-menu-left-ad, #bottom-ad, #leaderboardButton {
  display: none !important;
  visibility: hidden !important;
}

.actionBarItem, #stoneDisplay, #woodDisplay, #foodDisplay, #leaderboard, .gameButton, #killCounter, .resourceDisplay {
  border-radius: 10px !important;
}
</style>
`);
let WS;
let game = {
  tick: 0,
  tickQueue: [],
  tickRate: 1000 / 9,
  tickSpeed: 0,
  lastTick: performance.now(),
  get nextTick() {
    return performance.now() - this.lastTick + this.tickRate;
  },
  get serverLag() {
    return Math.abs(this.tickSpeed - this.tickRate);
  }
};
let lastMoveDir;
const isMohMoh = location.href.includes("mohmoh");

WebSocket.prototype.send = new Proxy(WebSocket.prototype.send, {
  __proto__: null,
  apply(targetObj, thisObj, argsArr) {
    if (!WS) {
      WS = thisObj;
      WS.addEventListener("message", getMessage);
    }

    const msg = msgpack.decode(argsArr[0]);

    if ((!isMohMoh ? ["0", "F"] : ["pp", "c", "2"]).includes(msg[0]) && /bundle|assets/gm.test((new Error).stack)) return;

    return Reflect.apply(targetObj, thisObj, argsArr);
  }
});

function packet(type) {
  if (!WS) return;

  let data = Array.prototype.slice.call(arguments, 1);
  let binary = window.msgpack.encode([location.href.includes("mohmoh") ? (clientTranslate.get(type) || type) : type, data]);
  WS.send(new Uint8Array(binary));
  packetsCount++;
}
let io = {
  send: packet
};

function getMessage(message) {
  let data = new Uint8Array(message.data);
  let parsed = window.msgpack.decode(data);
  let type = parsed[0];
  data = parsed[1];
  let events = !location.href.includes("mohmoh") ? {
    A: setInitData,
    C: setupGame,
    D: addPlayer,
    E: removePlayer,
    a: updatePlayers,
    H: loadGameObject,
    K: gatherAnimation,
    N: updatePlayerValue,
    O: updateHealth,
    P: killPlayer,
    Q: killObject,
    R: killObjects,
    S: updateItemCounts,
    T: updateAge,
    U: updateUpgrades,
    V: updateItems,
    X: addProjectile,
    Y: remProjectile,
    3: setPlayerTeam,
    4: setAlliancePlayers,
    5: updateStoreItems,
    6: receiveChat,
    sp: shootTurret,
    0: updatePing
  } : {
    id: setInitData,
    1: setupGame,
    2: addPlayer,
    4: removePlayer,
    33: updatePlayers,
    6: loadGameObject,
    7: gatherAnimation,
    9: updatePlayerValue,
    h: updateHealth,
    11: killPlayer,
    12: killObject,
    13: killObjects,
    14: updateItemCounts,
    15: updateAge,
    16: updateUpgrades,
    17: updateItems,
    18: addProjectile,
    19: remProjectile,
    st: setPlayerTeam,
    sa: setAlliancePlayers,
    us: updateStoreItems,
    ch: receiveChat,
    M: shootTurret,
    pp: updatePing
  };
  if (events[type]) {
    events[type].apply(undefined, data);
  }
}
let ticks = {
  tick: 0,
  delay: 0,
  time: [],
  manage: [],
};
let ais = [];
let players = [];
let alliances = [];
let alliancePlayers = [];
let gameObjects = [];
let projectiles = [];
let breakObjects = [];
let player;
let playerSID;
let tmpObj;
let enemy = [];
let near = [];
let my = {
  autoAim: false,
  revAim: false,
  ageInsta: true,
  lastDir: 0,
  autoPush: false,
}
// FIND OBJECTS BY ID/SID:
function findID(tmpObj, tmp) {
  return tmpObj.find((THIS) => THIS.id == tmp);
}

function findSID(tmpObj, tmp) {
  return tmpObj.find((THIS) => THIS.sid == tmp);
}

function findPlayerByID(id) {
  return findID(players, id);
}

function findPlayerBySID(sid) {
  return findSID(players, sid);
}

function findAIBySID(sid) {
  return findSID(ais, sid);
}

function findObjectBySid(sid) {
  return findSID(gameObjects, sid);
}

function findObjectBySidOptimised(sid) {
  return findSID(nearestGameObjects, sid);
}

function findProjectileBySid(sid) {
  return findSID(gameObjects, sid);
}
let screenWidth = window.innerWidth;
let screenHeight = window.innerHeight;
let maxScreenWidth = config.maxScreenWidth;
let maxScreenHeight = config.maxScreenHeight;
let delta;
let now;
let lastUpdate = performance.now();
let tmpDir;
let mouseX = 0;
let mouseY = 0;
let firstSetup = true;
let keys = {};
let moveKeys = {
  87: [0, -1],
  38: [0, -1],
  83: [0, 1],
  40: [0, 1],
  65: [-1, 0],
  37: [-1, 0],
  68: [1, 0],
  39: [1, 0],
};
let attackState = 0;
let inGame = false;
let macro = {};
let millC = {
  x: undefined,
  y: undefined,
  size: function(size) {
    return size * 1.45;
  },
  dist: function(size) {
    return size * 1.8;
  },
  active: config.isSandbox ? false : false,
  count: 0,
};
let mills = {
  place: 0,
  placeSpawnPads: 0
};
let lastDir;
/** CLASS CODES */
class Utils {
  constructor() {
    // MATH UTILS:
    let mathABS = Math.abs,
      mathCOS = Math.cos,
      mathSIN = Math.sin,
      mathPOW = Math.pow,
      mathSQRT = Math.sqrt,
      mathATAN2 = Math.atan2,
      mathPI = Math.PI;
    let _this = this;
    // GLOBAL UTILS:
    this.round = function(n, v) {
      return Math.round(n * v) / v;
    };
    this.toRad = function(angle) {
      return angle * (mathPI / 180);
    };
    this.toAng = function(radian) {
      return radian / (mathPI / 180);
    };
    this.randInt = function(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };
    this.randFloat = function(min, max) {
      return Math.random() * (max - min + 1) + min;
    };
    this.lerp = function(value1, value2, amount) {
      return value1 + (value2 - value1) * amount;
    };
    this.decel = function(val, cel) {
      if (val > 0) val = Math.max(0, val - cel);
      else if (val < 0) val = Math.min(0, val + cel);
      return val;
    };
    this.getDistance = function(x1, y1, x2, y2) {
      return mathSQRT((x2 -= x1) * x2 + (y2 -= y1) * y2);
    };
    this.getDist = function(tmp1, tmp2, type1, type2) {
      let tmpXY1 = {
        x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
        y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
      };
      let tmpXY2 = {
        x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
        y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
      };
      return mathSQRT((tmpXY2.x -= tmpXY1.x) * tmpXY2.x + (tmpXY2.y -= tmpXY1.y) * tmpXY2.y);
    };
    this.getDirection = function(x1, y1, x2, y2) {
      return mathATAN2(y1 - y2, x1 - x2);
    };
    this.getDirect = function(tmp1, tmp2, type1, type2) {
      let tmpXY1 = {
        x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
        y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
      };
      let tmpXY2 = {
        x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
        y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
      };
      return mathATAN2(tmpXY1.y - tmpXY2.y, tmpXY1.x - tmpXY2.x);
    };
    this.getAngleDist = function(a, b) {
      let p = mathABS(b - a) % (mathPI * 2);
      return (p > mathPI ? (mathPI * 2) - p : p);
    };
    this.lineInRect = function(recX, recY, recX2, recY2, x1, y1, x2, y2) {
      let minX = x1;
      let maxX = x2;
      if (x1 > x2) {
        minX = x2;
        maxX = x1;
      }
      if (maxX > recX2) maxX = recX2;
      if (minX < recX) minX = recX;
      if (minX > maxX) return false;
      let minY = y1;
      let maxY = y2;
      let dx = x2 - x1;
      if (Math.abs(dx) > 0.0000001) {
        let a = (y2 - y1) / dx;
        let b = y1 - a * x1;
        minY = a * minX + b;
        maxY = a * maxX + b;
      }
      if (minY > maxY) {
        let tmp = maxY;
        maxY = minY;
        minY = tmp;
      }
      if (maxY > recY2) maxY = recY2;
      if (minY < recY) minY = recY;
      if (minY > maxY) return false;
      return true;
    };
    this.checkTrusted = function(callback) {
      return function(ev) {
        if (ev && ev instanceof Event && (ev && typeof ev.isTrusted == "boolean" ? ev.isTrusted : false)) {
          callback(ev);
        } else {
          //console.error("Event is not trusted.", ev);
        }
      };
    };
  }
};
class GameObject {
  constructor(sid) {
    this.sid = sid;
    // INIT:
    this.init = function(x, y, dir, scale, type, data, owner) {
      data = data || {};
      this.sentTo = {};
      this.gridLocations = [];
      this.active = true;
      this.alive = true;
      this.doUpdate = data.doUpdate;
      this.x = x;
      this.y = y;
      if (config.idk) {
        this.dir = dir + Math.PI;
      } else {
        this.dir = dir;
      }
      this.lastDir = dir;
      this.xWiggle = 0;
      this.yWiggle = 0;
      this.visScale = scale;
      this.scale = scale;
      this.type = type;
      this.id = data.id;
      this.owner = owner;
      this.name = data.name;
      this.isItem = (this.id != undefined);
      this.group = data.group;
      this.maxHealth = data.health;
      this.health = this.maxHealth;
      this.layer = 2;
      if (this.group != undefined) {
        this.layer = this.group.layer;
      } else if (this.type == 0) {
        this.layer = 3;
      } else if (this.type == 2) {
        this.layer = 0;
      } else if (this.type == 4) {
        this.layer = -1;
      }
      this.colDiv = data.colDiv || 1;
      this.blocker = data.blocker;
      this.ignoreCollision = data.ignoreCollision;
      this.dontGather = data.dontGather;
      this.hideFromEnemy = data.hideFromEnemy;
      this.friction = data.friction;
      this.projDmg = data.projDmg;
      this.dmg = data.dmg;
      this.dmg = data.dmg;
      this.pps = data.pps;
      this.zIndex = data.zIndex || 0;
      this.turnSpeed = data.turnSpeed;
      this.req = data.req;
      this.trap = data.trap;
      this.healCol = data.healCol;
      this.teleport = data.teleport;
      this.boostSpeed = data.boostSpeed;
      this.projectile = data.projectile;
      this.shootRange = data.shootRange;
      this.shootRate = data.shootRate;
      this.shootCount = this.shootRate;
      this.spawnPoint = data.spawnPoint;
      this.onNear = 0;
      this.breakObj = false;
      this.alpha = data.alpha || 1;
      this.maxAlpha = data.alpha || 1;
      this.damaged = 0;
    };
    // GET HIT:
    this.changeHealth = function(amount, doer) {
      this.health += amount;
      return (this.health <= 0);
    };
    // GET SCALE:
    this.getScale = function(sM, ig) {
      sM = sM || 1;
      return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4) ? 1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
    };
    // VISIBLE TO PLAYER:
    this.visibleToPlayer = function(player) {
      return !(this.hideFromEnemy) || (this.owner && (this.owner == player || (this.owner.team && player.team == this.owner.team)));
    };
    // UPDATE:
    this.update = function(delta) {
      if (this.active) {
        if (this.xWiggle) {
          this.xWiggle *= Math.pow(0.99, delta);
        }
        if (this.yWiggle) {
          this.yWiggle *= Math.pow(0.99, delta);
        }
        if (config.anotherVisual) {
          let d2 = UTILS.getAngleDist(this.lastDir, this.dir);
          if (d2 > 0.01) {
            this.dir += d2 / 5;
          } else {
            this.dir = this.lastDir;
          }
        } else {
          if (this.turnSpeed && this.dmg) {
            this.dir += this.turnSpeed * delta;
          }
        }
      } else {
        if (this.alive) {
          this.alpha -= delta / (200 / this.maxAlpha);
          this.visScale += delta / (this.scale / 2.5);
          if (this.alpha <= 0) {
            this.alpha = 0;
            this.alive = false;
          }
        }
      }
    };
    // CHECK TEAM:
    this.isTeamObject = function(tmpObj) {
      return this.owner == null ? true : (this.owner && tmpObj.sid == this.owner.sid || tmpObj.findAllianceBySid(this.owner.sid));
    };
  }
}
class Items {
  constructor() {
    // ITEM GROUPS:
    this.groups = [{
      id: 0,
      name: "food",
      layer: 0
    }, {
      id: 1,
      name: "walls",
      place: true,
      limit: 30,
      layer: 0
    }, {
      id: 2,
      name: "spikes",
      place: true,
      limit: 15,
      layer: 0
    }, {
      id: 3,
      name: "mill",
      place: true,
      limit: 7,
      layer: 1
    }, {
      id: 4,
      name: "mine",
      place: true,
      limit: 1,
      layer: 0
    }, {
      id: 5,
      name: "trap",
      place: true,
      limit: 6,
      layer: -1
    }, {
      id: 6,
      name: "booster",
      place: true,
      limit: 12,
      layer: -1
    }, {
      id: 7,
      name: "turret",
      place: true,
      limit: 2,
      layer: 1
    }, {
      id: 8,
      name: "watchtower",
      place: true,
      limit: 12,
      layer: 1
    }, {
      id: 9,
      name: "buff",
      place: true,
      limit: 4,
      layer: -1
    }, {
      id: 10,
      name: "spawn",
      place: true,
      limit: 1,
      layer: -1
    }, {
      id: 11,
      name: "sapling",
      place: true,
      limit: 2,
      layer: 0
    }, {
      id: 12,
      name: "blocker",
      place: true,
      limit: 3,
      layer: -1
    }, {
      id: 13,
      name: "teleporter",
      place: true,
      limit: 2,
      layer: -1
    }];
    // PROJECTILES:
    this.projectiles = [{
      indx: 0,
      layer: 0,
      src: "arrow_1",
      dmg: 25,
      speed: 1.6,
      scale: 103,
      range: 1000
    }, {
      indx: 1,
      layer: 1,
      dmg: 25,
      scale: 20
    }, {
      indx: 0,
      layer: 0,
      src: "arrow_1",
      dmg: 35,
      speed: 2.5,
      scale: 103,
      range: 1200
    }, {
      indx: 0,
      layer: 0,
      src: "arrow_1",
      dmg: 30,
      speed: 2,
      scale: 103,
      range: 1200
    }, {
      indx: 1,
      layer: 1,
      dmg: 16,
      scale: 20
    }, {
      indx: 0,
      layer: 0,
      src: "bullet_1",
      dmg: 50,
      speed: 3.6,
      scale: 160,
      range: 1400
    }];
    // WEAPONS:
    this.weapons = [{
      id: 0,
      type: 0,
      name: "tool hammer",
      desc: "tool for gathering all resources",
      src: "hammer_1",
      length: 140,
      width: 140,
      xOff: -3,
      yOff: 18,
      dmg: 25,
      range: 65,
      gather: 1,
      speed: 300
    }, {
      id: 1,
      type: 0,
      age: 2,
      name: "hand axe",
      desc: "gathers resources at a higher rate",
      src: "axe_1",
      length: 140,
      width: 140,
      xOff: 3,
      yOff: 24,
      dmg: 30,
      spdMult: 1,
      range: 70,
      gather: 2,
      speed: 400
    }, {
      id: 2,
      type: 0,
      age: 8,
      pre: 1,
      name: "great axe",
      desc: "deal more damage and gather more resources",
      src: "great_axe_1",
      length: 140,
      width: 140,
      xOff: -8,
      yOff: 25,
      dmg: 35,
      spdMult: 1,
      range: 75,
      gather: 4,
      speed: 400
    }, {
      id: 3,
      type: 0,
      age: 2,
      name: "short sword",
      desc: "increased attack power but slower move speed",
      src: "sword_1",
      iPad: 1.3,
      length: 130,
      width: 210,
      xOff: -8,
      yOff: 46,
      dmg: 35,
      spdMult: 0.85,
      range: 110,
      gather: 1,
      speed: 300
    }, {
      id: 4,
      type: 0,
      age: 8,
      pre: 3,
      name: "katana",
      desc: "greater range and damage",
      src: "samurai_1",
      iPad: 1.3,
      length: 130,
      width: 210,
      xOff: -8,
      yOff: 59,
      dmg: 40,
      spdMult: 0.8,
      range: 118,
      gather: 1,
      speed: 300
    }, {
      id: 5,
      type: 0,
      age: 2,
      name: "polearm",
      desc: "long range melee weapon",
      src: "spear_1",
      iPad: 1.3,
      length: 130,
      width: 210,
      xOff: -8,
      yOff: 53,
      dmg: 45,
      knock: 0.2,
      spdMult: 0.82,
      range: 142,
      gather: 1,
      speed: 700
    }, {
      id: 6,
      type: 0,
      age: 2,
      name: "bat",
      desc: "fast long range melee weapon",
      src: "bat_1",
      iPad: 1.3,
      length: 110,
      width: 180,
      xOff: -8,
      yOff: 53,
      dmg: 20,
      knock: 0.7,
      range: 110,
      gather: 1,
      speed: 300
    }, {
      id: 7,
      type: 0,
      age: 2,
      name: "daggers",
      desc: "really fast short range weapon",
      src: "dagger_1",
      iPad: 0.8,
      length: 110,
      width: 110,
      xOff: 18,
      yOff: 0,
      dmg: 20,
      knock: 0.1,
      range: 65,
      gather: 1,
      hitSlow: 0.1,
      spdMult: 1.13,
      speed: 100
    }, {
      id: 8,
      type: 0,
      age: 2,
      name: "stick",
      desc: "great for gathering but very weak",
      src: "stick_1",
      length: 140,
      width: 140,
      xOff: 3,
      yOff: 24,
      dmg: 1,
      spdMult: 1,
      range: 70,
      gather: 7,
      speed: 400
    }, {
      id: 9,
      type: 1,
      age: 6,
      name: "hunting bow",
      desc: "bow used for ranged combat and hunting",
      src: "bow_1",
      req: ["wood", 4],
      length: 120,
      width: 120,
      xOff: -6,
      yOff: 0,
      dmg: 25,
      projectile: 0,
      spdMult: 0.75,
      speed: 600
    }, {
      id: 10,
      type: 1,
      age: 6,
      name: "great hammer",
      desc: "hammer used for destroying structures",
      src: "great_hammer_1",
      length: 140,
      width: 140,
      xOff: -9,
      yOff: 25,
      dmg: 10,
      dmg: 10,
      spdMult: 0.88,
      range: 75,
      sDmg: 7.5,
      gather: 1,
      speed: 400
    }, {
      id: 11,
      type: 1,
      age: 6,
      name: "wooden shield",
      desc: "blocks projectiles and reduces melee damage",
      src: "shield_1",
      length: 120,
      width: 120,
      shield: 0.2,
      xOff: 6,
      yOff: 0,
      dmg: 0,
      spdMult: 0.7
    }, {
      id: 12,
      type: 1,
      age: 8,
      pre: 9,
      name: "crossbow",
      desc: "deals more damage and has greater range",
      src: "crossbow_1",
      req: ["wood", 5],
      aboveHand: true,
      armS: 0.75,
      length: 120,
      width: 120,
      xOff: -4,
      yOff: 0,
      dmg: 35,
      projectile: 2,
      spdMult: 0.7,
      speed: 700
    }, {
      id: 13,
      type: 1,
      age: 9,
      pre: 12,
      name: "repeater crossbow",
      desc: "high firerate crossbow with reduced damage",
      src: "crossbow_2",
      req: ["wood", 10],
      aboveHand: true,
      armS: 0.75,
      length: 120,
      width: 120,
      xOff: -4,
      yOff: 0,
      dmg: 30,
      projectile: 3,
      spdMult: 0.7,
      speed: 230
    }, {
      id: 14,
      type: 1,
      age: 6,
      name: "mc grabby",
      desc: "steals resources from enemies",
      src: "grab_1",
      length: 130,
      width: 210,
      xOff: -8,
      yOff: 53,
      dmg: 0,
      dmg: 0,
      steal: 250,
      knock: 0.2,
      spdMult: 1.05,
      range: 125,
      gather: 0,
      speed: 700
    }, {
      id: 15,
      type: 1,
      age: 9,
      pre: 12,
      name: "musket",
      desc: "slow firerate but high damage and range",
      src: "musket_1",
      req: ["stone", 10],
      aboveHand: true,
      rec: 0.35,
      armS: 0.6,
      hndS: 0.3,
      hndD: 1.6,
      length: 205,
      width: 205,
      xOff: 25,
      yOff: 0,
      dmg: 50,
      projectile: 5,
      hideProjectile: true,
      spdMult: 0.6,
      speed: 1500
    }];
    // ITEMS:
    this.list = [{
      group: this.groups[0],
      name: "apple",
      desc: "restores 20 health when consumed",
      req: ["food", 10],
      consume: function(doer) {
        return doer.changeHealth(20, doer);
      },
      scale: 22,
      holdOffset: 15,
      healing: 20,
      itemID: 0,
      itemAID: 16,
    }, {
      age: 3,
      group: this.groups[0],
      name: "cookie",
      desc: "restores 40 health when consumed",
      req: ["food", 15],
      consume: function(doer) {
        return doer.changeHealth(40, doer);
      },
      scale: 27,
      holdOffset: 15,
      healing: 40,
      itemID: 1,
      itemAID: 17,
    }, {
      age: 7,
      group: this.groups[0],
      name: "cheese",
      desc: "restores 30 health and another 50 over 5 seconds",
      req: ["food", 25],
      consume: function(doer) {
        if (doer.changeHealth(30, doer) || doer.health < 100) {
          doer.dmgOverTime.dmg = -10;
          doer.dmgOverTime.doer = doer;
          doer.dmgOverTime.time = 5;
          return true;
        }
        return false;
      },
      scale: 27,
      holdOffset: 15,
      healing: 30,
      itemID: 2,
      itemAID: 18,
    }, {
      group: this.groups[1],
      name: "wood wall",
      desc: "provides protection for your village",
      req: ["wood", 10],
      projDmg: true,
      health: 380,
      scale: 50,
      holdOffset: 20,
      placeOffset: -5,
      itemID: 3,
      itemAID: 19,
    }, {
      age: 3,
      group: this.groups[1],
      name: "stone wall",
      desc: "provides improved protection for your village",
      req: ["stone", 25],
      health: 900,
      scale: 50,
      holdOffset: 20,
      placeOffset: -5,
      itemID: 4,
      itemAID: 20,
    }, {
      age: 7,
      group: this.groups[1],
      name: "castle wall",
      desc: "provides powerful protection for your village",
      req: ["stone", 35],
      health: 1500,
      scale: 52,
      holdOffset: 20,
      placeOffset: -5,
      itemID: 5,
      itemAID: 21,
    }, {
      group: this.groups[2],
      name: "spikes",
      desc: "damages enemies when they touch them",
      req: ["wood", 20, "stone", 5],
      health: 400,
      dmg: 20,
      scale: 49,
      spritePadding: -23,
      holdOffset: 8,
      placeOffset: -5,
      itemID: 6,
      itemAID: 22,
    }, {
      age: 5,
      group: this.groups[2],
      name: "greater spikes",
      desc: "damages enemies when they touch them",
      req: ["wood", 30, "stone", 10],
      health: 500,
      dmg: 35,
      scale: 52,
      spritePadding: -23,
      holdOffset: 8,
      placeOffset: -5,
      itemID: 7,
      itemAID: 23,
    }, {
      age: 9,
      group: this.groups[2],
      name: "poison spikes",
      desc: "poisons enemies when they touch them",
      req: ["wood", 35, "stone", 15],
      health: 600,
      dmg: 30,
      dmg: 5,
      scale: 52,
      spritePadding: -23,
      holdOffset: 8,
      placeOffset: -5,
      itemID: 8,
      itemAID: 24,
    }, {
      age: 9,
      group: this.groups[2],
      name: "spinning spikes",
      desc: "damages enemies when they touch them",
      req: ["wood", 30, "stone", 20],
      health: 500,
      dmg: 45,
      turnSpeed: 0.003,
      scale: 52,
      spritePadding: -23,
      holdOffset: 8,
      placeOffset: -5,
      itemID: 9,
      itemAID: 25,
    }, {
      group: this.groups[3],
      name: "windmill",
      desc: "generates gold over time",
      req: ["wood", 50, "stone", 10],
      health: 400,
      pps: 1,
      turnSpeed: 0.0016,
      spritePadding: 25,
      iconLineMult: 12,
      scale: 45,
      holdOffset: 20,
      placeOffset: 5,
      itemID: 10,
      itemAID: 26,
    }, {
      age: 5,
      group: this.groups[3],
      name: "faster windmill",
      desc: "generates more gold over time",
      req: ["wood", 60, "stone", 20],
      health: 500,
      pps: 1.5,
      turnSpeed: 0.0025,
      spritePadding: 25,
      iconLineMult: 12,
      scale: 47,
      holdOffset: 20,
      placeOffset: 5,
      itemID: 11,
      itemAID: 27,
    }, {
      age: 8,
      group: this.groups[3],
      name: "power mill",
      desc: "generates more gold over time",
      req: ["wood", 100, "stone", 50],
      health: 800,
      pps: 2,
      turnSpeed: 0.005,
      spritePadding: 25,
      iconLineMult: 12,
      scale: 47,
      holdOffset: 20,
      placeOffset: 5,
      itemID: 12,
      itemAID: 28,
    }, {
      age: 5,
      group: this.groups[4],
      type: 2,
      name: "mine",
      desc: "allows you to mine stone",
      req: ["wood", 20, "stone", 100],
      iconLineMult: 12,
      scale: 65,
      holdOffset: 20,
      placeOffset: 0,
      itemID: 13,
      itemAID: 29,
    }, {
      age: 5,
      group: this.groups[11],
      type: 0,
      name: "sapling",
      desc: "allows you to farm wood",
      req: ["wood", 150],
      iconLineMult: 12,
      colDiv: 0.5,
      scale: 110,
      holdOffset: 50,
      placeOffset: -15,
      itemID: 14,
      itemAID: 30,
    }, {
      age: 4,
      group: this.groups[5],
      name: "pit trap",
      desc: "pit that traps enemies if they walk over it",
      req: ["wood", 30, "stone", 30],
      trap: true,
      ignoreCollision: true,
      hideFromEnemy: true,
      health: 500,
      colDiv: 0.2,
      scale: 50,
      holdOffset: 20,
      placeOffset: -5,
      alpha: 0.6,
      itemID: 15,
      itemAID: 31,
    }, {
      age: 4,
      group: this.groups[6],
      name: "boost pad",
      desc: "provides boost when stepped on",
      req: ["stone", 20, "wood", 5],
      ignoreCollision: true,
      boostSpeed: 1.5,
      health: 150,
      colDiv: 0.7,
      scale: 45,
      holdOffset: 20,
      placeOffset: -5,
      itemID: 16,
      itemAID: 32,
    }, {
      age: 7,
      group: this.groups[7],
      doUpdate: true,
      name: "turret",
      desc: "defensive structure that shoots at enemies",
      req: ["wood", 200, "stone", 150],
      health: 800,
      projectile: 1,
      shootRange: 700,
      shootRate: 2200,
      scale: 43,
      holdOffset: 20,
      placeOffset: -5,
      itemID: 17,
      itemAID: 33,
    }, {
      age: 7,
      group: this.groups[8],
      name: "platform",
      desc: "platform to shoot over walls and cross over water",
      req: ["wood", 20],
      ignoreCollision: true,
      zIndex: 1,
      health: 300,
      scale: 43,
      holdOffset: 20,
      placeOffset: -5,
      itemID: 18,
      itemAID: 34,
    }, {
      age: 7,
      group: this.groups[9],
      name: "healing pad",
      desc: "standing on it will slowly heal you",
      req: ["wood", 30, "food", 10],
      ignoreCollision: true,
      healCol: 15,
      health: 400,
      colDiv: 0.7,
      scale: 45,
      holdOffset: 20,
      placeOffset: -5,
      itemID: 19,
      itemAID: 35,
    }, {
      age: 9,
      group: this.groups[10],
      name: "spawn pad",
      desc: "you will spawn here when you die but it will dissapear",
      req: ["wood", 100, "stone", 100],
      health: 400,
      ignoreCollision: true,
      spawnPoint: true,
      scale: 45,
      holdOffset: 20,
      placeOffset: -5,
      itemID: 20,
      itemAID: 36,
    }, {
      age: 7,
      group: this.groups[12],
      name: "blocker",
      desc: "blocks building in radius",
      req: ["wood", 30, "stone", 25],
      ignoreCollision: true,
      blocker: 300,
      health: 400,
      colDiv: 0.7,
      scale: 45,
      holdOffset: 20,
      placeOffset: -5,
      itemID: 21,
      itemAID: 37,
    }, {
      age: 7,
      group: this.groups[13],
      name: "teleporter",
      desc: "teleports you to a random point on the map",
      req: ["wood", 60, "stone", 60],
      ignoreCollision: true,
      teleport: true,
      health: 200,
      colDiv: 0.7,
      scale: 45,
      holdOffset: 20,
      placeOffset: -5,
      itemID: 22,
      itemAID: 38
    }];
    // CHECK ITEM ID:
    this.checkItem = {
      index: function(id, myItems) {
        return [0, 1, 2].includes(id) ? 0 : [3, 4, 5].includes(id) ? 1 : [6, 7, 8, 9].includes(id) ? 2 : [10, 11, 12].includes(id) ? 3 : [13, 14].includes(id) ? 5 : [15, 16].includes(id) ? 4 : [17, 18, 19, 21, 22].includes(id) ? [13, 14].includes(myItems) ? 6 : 5 : id == 20 ? [13, 14].includes(myItems) ? 7 : 6 : undefined;
      }
    }
    // ASSIGN IDS:
    for (let i = 0; i < this.list.length; ++i) {
      this.list[i].id = i;
      if (this.list[i].pre) this.list[i].pre = i - this.list[i].pre;
    }
  }
}
class Objectmanager {
  constructor(GameObject, gameObjects, UTILS, config, players, server) {
    let mathFloor = Math.floor,
      mathABS = Math.abs,
      mathCOS = Math.cos,
      mathSIN = Math.sin,
      mathPOW = Math.pow,
      mathSQRT = Math.sqrt;
    this.ignoreAdd = false;
    this.hitObj = [];
    // DISABLE OBJ:
    this.disableObj = function(obj) {
      obj.active = false;
      if (config.idk) {} else {
        obj.alive = false;
      }
    };
    // ADD NEW:
    let tmpObj;
    this.add = function(sid, x, y, dir, s, type, data, setSID, owner) {
      tmpObj = findObjectBySid(sid);
      if (!tmpObj) {
        tmpObj = gameObjects.find((tmp) => !tmp.active);
        if (!tmpObj) {
          tmpObj = new GameObject(sid);
          gameObjects.push(tmpObj);
          traps.tempObjects = traps.tempObjects.filter(e => Math.hypot(x - e.x, y - e.y) > e.scale + tmpObj.scale);
          placedThisTick = placedThisTick.filter(e => Math.hypot(x - e.x, y - e.y) > e.scale + tmpObj.scale);
        }
      }
      if (setSID) {
        tmpObj.sid = sid;
      }
      tmpObj.init(x, y, dir, s, type, data, owner);
    };
    // DISABLE BY SID:
    this.disableBySid = function(sid) {
      let find = findObjectBySid(sid);
      if (find) {
        this.disableObj(find);
      }
    };
    // REMOVE ALL FROM PLAYER:
    this.removeAllItems = function(sid, server) {
      gameObjects.filter((tmp) => tmp.active && tmp.owner && tmp.owner.sid == sid).forEach((tmp) => this.disableObj(tmp));
    };
  }
}
class Projectile {
  constructor(players, ais, objectManager, items, config, UTILS, server) {
    // INIT:
    this.init = function(indx, x, y, dir, spd, dmg, rng, scl, owner) {
      this.shootReload = 2200 - (1000 / 9) * 2;
      this.shootted = 0;
      this.active = true;
      this.tickActive = true;
      this.indx = indx;
      this.x = x;
      this.y = y;
      this.x2 = x;
      this.y2 = y;
      this.dir = dir;
      this.skipMov = true;
      this.speed = spd;
      this.dmg = dmg;
      this.scale = scl;
      this.range = rng;
      this.r2 = rng;
      this.owner = owner;
    };
    // UPDATE:
    this.update = function(delta) {
      if (this.active) {
        let tmpSpeed = this.speed * delta;
        if (!this.skipMov) {
          this.x += tmpSpeed * Math.cos(this.dir);
          this.y += tmpSpeed * Math.sin(this.dir);
          this.range -= tmpSpeed;
          if (this.range <= 0) {
            this.x += this.range * Math.cos(this.dir);
            this.y += this.range * Math.sin(this.dir);
            tmpSpeed = 1;
            this.range = 0;
            this.active = false;
          }
        } else {
          this.skipMov = false;
        }
      }
    };
  }
};
class Store {
  constructor() {
    // STORE HATS:
    this.hats = [{
      id: 45,
      name: "Shame!",
      dontSell: true,
      price: 0,
      scale: 120,
      desc: "hacks are for winners"
    }, {
      id: 51,
      name: "Moo Cap",
      price: 0,
      scale: 120,
      desc: "coolest mooer around"
    }, {
      id: 50,
      name: "Apple Cap",
      price: 0,
      scale: 120,
      desc: "apple farms remembers"
    }, {
      id: 28,
      name: "Moo Head",
      price: 0,
      scale: 120,
      desc: "no effect"
    }, {
      id: 29,
      name: "Pig Head",
      price: 0,
      scale: 120,
      desc: "no effect"
    }, {
      id: 30,
      name: "Fluff Head",
      price: 0,
      scale: 120,
      desc: "no effect"
    }, {
      id: 36,
      name: "Pandou Head",
      price: 0,
      scale: 120,
      desc: "no effect"
    }, {
      id: 37,
      name: "Bear Head",
      price: 0,
      scale: 120,
      desc: "no effect"
    }, {
      id: 38,
      name: "Monkey Head",
      price: 0,
      scale: 120,
      desc: "no effect"
    }, {
      id: 44,
      name: "Polar Head",
      price: 0,
      scale: 120,
      desc: "no effect"
    }, {
      id: 35,
      name: "Fez Hat",
      price: 0,
      scale: 120,
      desc: "no effect"
    }, {
      id: 42,
      name: "Enigma Hat",
      price: 0,
      scale: 120,
      desc: "join the enigma army"
    }, {
      id: 43,
      name: "Blitz Hat",
      price: 0,
      scale: 120,
      desc: "hey everybody i'm blitz"
    }, {
      id: 49,
      name: "Bob XIII Hat",
      price: 0,
      scale: 120,
      desc: "like and subscribe"
    }, {
      id: 57,
      name: "Pumpkin",
      price: 50,
      scale: 120,
      desc: "Spooooky"
    }, {
      id: 8,
      name: "Bummle Hat",
      price: 100,
      scale: 120,
      desc: "no effect"
    }, {
      id: 2,
      name: "Straw Hat",
      price: 500,
      scale: 120,
      desc: "no effect"
    }, {
      id: 15,
      name: "Winter Cap",
      price: 600,
      scale: 120,
      desc: "allows you to move at normal speed in snow",
      coldM: 1
    }, {
      id: 5,
      name: "Cowboy Hat",
      price: 1000,
      scale: 120,
      desc: "no effect"
    }, {
      id: 4,
      name: "Ranger Hat",
      price: 2000,
      scale: 120,
      desc: "no effect"
    }, {
      id: 18,
      name: "Explorer Hat",
      price: 2000,
      scale: 120,
      desc: "no effect"
    }, {
      id: 31,
      name: "Flipper Hat",
      price: 2500,
      scale: 120,
      desc: "have more control while in water",
      watrImm: true
    }, {
      id: 1,
      name: "Marksman Cap",
      price: 3000,
      scale: 120,
      desc: "increases arrow speed and range",
      aMlt: 1.3
    }, {
      id: 10,
      name: "Bush Gear",
      price: 3000,
      scale: 160,
      desc: "allows you to disguise yourself as a bush"
    }, {
      id: 48,
      name: "Halo",
      price: 3000,
      scale: 120,
      desc: "no effect"
    }, {
      id: 6,
      name: "Soldier Helmet",
      price: 4000,
      scale: 120,
      desc: "reduces damage taken but slows movement",
      spdMult: 0.94,
      dmgMult: 0.75
    }, {
      id: 23,
      name: "Anti Venom Gear",
      price: 4000,
      scale: 120,
      desc: "makes you immune to poison",
      poisonRes: 1
    }, {
      id: 13,
      name: "Medic Gear",
      price: 5000,
      scale: 110,
      desc: "slowly regenerates health over time",
      healthRegen: 3
    }, {
      id: 9,
      name: "Miners Helmet",
      price: 5000,
      scale: 120,
      desc: "earn 1 extra gold per resource",
      extraGold: 1
    }, {
      id: 32,
      name: "Musketeer Hat",
      price: 5000,
      scale: 120,
      desc: "reduces cost of projectiles",
      projCost: 0.5
    }, {
      id: 7,
      name: "Bull Helmet",
      price: 6000,
      scale: 120,
      desc: "increases damage done but drains health",
      healthRegen: -5,
      dmgMultO: 1.5,
      spdMult: 0.96
    }, {
      id: 22,
      name: "Emp Helmet",
      price: 6000,
      scale: 120,
      desc: "turrets won't attack but you move slower",
      antiTurret: 1,
      spdMult: 0.7
    }, {
      id: 12,
      name: "Booster Hat",
      price: 6000,
      scale: 120,
      desc: "increases your movement speed",
      spdMult: 1.16
    }, {
      id: 26,
      name: "Barbarian Armor",
      price: 8000,
      scale: 120,
      desc: "knocks back enemies that attack you",
      dmgK: 0.6
    }, {
      id: 21,
      name: "Plague Mask",
      price: 10000,
      scale: 120,
      desc: "melee attacks deal poison damage",
      poisonDmg: 5,
      poisonTime: 6
    }, {
      id: 46,
      name: "Bull Mask",
      price: 10000,
      scale: 120,
      desc: "bulls won't target you unless you attack them",
      bullRepel: 1
    }, {
      id: 14,
      name: "Windmill Hat",
      topSprite: true,
      price: 10000,
      scale: 120,
      desc: "generates points while worn",
      pps: 1.5
    }, {
      id: 11,
      name: "Spike Gear",
      topSprite: true,
      price: 10000,
      scale: 120,
      desc: "deal damage to players that damage you",
      dmg: 0.45
    }, {
      id: 53,
      name: "Turret Gear",
      topSprite: true,
      price: 10000,
      scale: 120,
      desc: "you become a walking turret",
      turret: {
        proj: 1,
        range: 700,
        rate: 2500
      },
      spdMult: 0.7
    }, {
      id: 20,
      name: "Samurai Armor",
      price: 12000,
      scale: 120,
      desc: "increased attack speed and fire rate",
      atkSpd: 0.78
    }, {
      id: 58,
      name: "Dark Knight",
      price: 12000,
      scale: 120,
      desc: "restores health when you deal damage",
      healD: 0.4
    }, {
      id: 27,
      name: "Scavenger Gear",
      price: 15000,
      scale: 120,
      desc: "earn double points for each kill",
      kScrM: 2
    }, {
      id: 40,
      name: "Tank Gear",
      price: 15000,
      scale: 120,
      desc: "increased damage to buildings but slower movement",
      spdMult: 0.3,
      bDmg: 3.3
    }, {
      id: 52,
      name: "Thief Gear",
      price: 15000,
      scale: 120,
      desc: "steal half of a players gold when you kill them",
      goldSteal: 0.5
    }, {
      id: 55,
      name: "Bloodthirster",
      price: 20000,
      scale: 120,
      desc: "Restore Health when dealing damage. And increased damage",
      healD: 0.25,
      dmgMultO: 1.2,
    }, {
      id: 56,
      name: "Assassin Gear",
      price: 20000,
      scale: 120,
      desc: "Go invisible when not moving. Can't eat. Increased speed",
      noEat: true,
      spdMult: 1.1,
      invisTimer: 1000
    }];
    // STORE ACCESSORIES:
    this.accessories = [{
      id: 12,
      name: "Snowball",
      price: 1000,
      scale: 105,
      xOff: 18,
      desc: "no effect"
    }, {
      id: 9,
      name: "Tree Cape",
      price: 1000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 10,
      name: "Stone Cape",
      price: 1000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 3,
      name: "Cookie Cape",
      price: 1500,
      scale: 90,
      desc: "no effect"
    }, {
      id: 8,
      name: "Cow Cape",
      price: 2000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 11,
      name: "Monkey Tail",
      price: 2000,
      scale: 97,
      xOff: 25,
      desc: "Super speed but reduced damage",
      spdMult: 1.35,
      dmgMultO: 0.2
    }, {
      id: 17,
      name: "Apple Basket",
      price: 3000,
      scale: 80,
      xOff: 12,
      desc: "slowly regenerates health over time",
      healthRegen: 1
    }, {
      id: 6,
      name: "Winter Cape",
      price: 3000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 4,
      name: "Skull Cape",
      price: 4000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 5,
      name: "Dash Cape",
      price: 5000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 2,
      name: "Dragon Cape",
      price: 6000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 1,
      name: "Super Cape",
      price: 8000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 7,
      name: "Troll Cape",
      price: 8000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 14,
      name: "Thorns",
      price: 10000,
      scale: 115,
      xOff: 20,
      desc: "no effect"
    }, {
      id: 15,
      name: "Blockades",
      price: 10000,
      scale: 95,
      xOff: 15,
      desc: "no effect"
    }, {
      id: 20,
      name: "Devils Tail",
      price: 10000,
      scale: 95,
      xOff: 20,
      desc: "no effect"
    }, {
      id: 16,
      name: "Sawblade",
      price: 12000,
      scale: 90,
      spin: true,
      xOff: 0,
      desc: "deal damage to players that damage you",
      dmg: 0.15
    }, {
      id: 13,
      name: "Angel Wings",
      price: 15000,
      scale: 138,
      xOff: 22,
      desc: "slowly regenerates health over time",
      healthRegen: 3
    }, {
      id: 19,
      name: "Shadow Wings",
      price: 15000,
      scale: 138,
      xOff: 22,
      desc: "increased movement speed",
      spdMult: 1.1
    }, {
      id: 18,
      name: "Blood Wings",
      price: 20000,
      scale: 178,
      xOff: 26,
      desc: "restores health when you deal damage",
      healD: 0.2
    }, {
      id: 21,
      name: "Corrupt X Wings",
      price: 20000,
      scale: 178,
      xOff: 26,
      desc: "deal damage to players that damage you",
      dmg: 0.25
    }];
  }
};
class ProjectileManager {
  constructor(Projectile, projectiles, players, ais, objectManager, items, config, UTILS, server) {
    this.addProjectile = function(x, y, dir, range, speed, indx, owner, ignoreObj, layer, inWindow) {
      let tmpData = items.projectiles[indx];
      let tmpProj;
      for (let i = 0; i < projectiles.length; ++i) {
        if (!projectiles[i].active) {
          tmpProj = projectiles[i];
          break;
        }
      }
      if (!tmpProj) {
        tmpProj = new Projectile(players, ais, objectManager, items, config, UTILS, server);
        tmpProj.sid = projectiles.length;
        projectiles.push(tmpProj);
      }
      tmpProj.init(indx, x, y, dir, speed, tmpData.dmg, range, tmpData.scale, owner);
      tmpProj.ignoreObj = ignoreObj;
      tmpProj.layer = layer || tmpData.layer;
      tmpProj.inWindow = inWindow;
      tmpProj.src = tmpData.src;
      return tmpProj;
    };
  }
};
class Player {
  constructor(id, sid, config, UTILS, projectileManager, objectManager, players, ais, items, hats, accessories, server, scoreCallback, iconCallback) {
    this.id = id;
    this.sid = sid;
    this.tmpScore = 0;
    this.team = null;
    this.latestSkin = 0;
    this.oldSkinIndex = 0;
    this.skinIndex = 0;
    this.latestTail = 0;
    this.oldTailIndex = 0;
    this.tailIndex = 0;
    this.hitTime = 0;
    this.lastHit = 0;
    this.tails = {};
    for (let i = 0; i < accessories.length; ++i) {
      if (accessories[i].price <= 0) this.tails[accessories[i].id] = 1;
    }
    this.skins = {};
    for (let i = 0; i < hats.length; ++i) {
      if (hats[i].price <= 0) this.skins[hats[i].id] = 1;
    }
    this.points = 0;
    this.dt = 0;
    this.ping = 111;
    this.hidden = false;
    this.itemCounts = {};
    this.isPlayer = true;
    this.pps = 0;
    this.moveDir;
    this.iconIndex = 0;
    this.skinColor = 0;
    this.dist2 = 0;
    this.aim2 = 0;
    this.maxSpeed = 1;
    this.chat = {
      message: null,
      count: 0
    };
    // SPAWN:
    this.spawn = function(moofoll) {
      this.attacked = false;
      this.death = false;
      this.spinDir = 0;
      this.sync = false;
      this.bullTimer = 0;
      this.poisonTimer = 0;
      this.active = true;
      this.alive = true;
      this.lockMove = false;
      this.lockDir = false;
      this.minimapCounter = 0;
      this.chatCountdown = 0;
      this.shameCount = 0;
      this.shameTimer = 0;
      this.sentTo = {};
      this.gathering = 0;
      this.gatherIndex = 0;
      this.shooting = {};
      this.shootIndex = 15;
      this.autoGather = 0;
      this.animTime = 0;
      this.animSpeed = 0;
      this.mouseState = 0;
      this.buildIndex = -1;
      this.weaponIndex = 0;
      this.weaponCode = 0;
      this.weaponVariant = 0;
      this.dmgOverTime = {};
      this.noMovTimer = 0;
      this.maxXP = 300;
      this.XP = 0;
      this.age = 1;
      this.kills = 0;
      this.upgrAge = 2;
      this.upgradePoints = 0;
      this.x = 0;
      this.y = 0;
      this.oldXY = {
        x: 0,
        y: 0
      };
      this.zIndex = 0;
      this.xVel = 0;
      this.yVel = 0;
      this.slowMult = 1;
      this.dir = 0;
      this.dirPlus = 0;
      this.targetDir = 0;
      this.targetAngle = 0;
      this.maxHealth = 100;
      this.health = this.maxHealth;
      this.oldHealth = this.maxHealth;
      this.damaged = 0;
      this.scale = config.playerScale;
      this.speed = config.playerSpeed;
      this.resetMoveDir();
      this.resetResources(moofoll);
      this.items = [0, 3, 6, 10];
      this.weapons = [0];
      this.shootCount = 0;
      this.weaponXP = [];
      this.reloads = {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
        7: 0,
        8: 0,
        9: 0,
        10: 0,
        11: 0,
        12: 0,
        13: 0,
        14: 0,
        15: 0,
        53: 0,
      };
      this.bowThreat = {
        9: 0,
        12: 0,
        13: 0,
        15: 0,
      };
      this.inTrap = false;
      this.poisonTick = 0;
      this.bullTick = 0;
      this.setPoisonTick = false;
      this.setBullTick = false;
      this.antiTimer = 2;
    };
    // RESET MOVE DIR:
    this.resetMoveDir = function() {
      delete this.moveDir;
    };
    // RESET RESOURCES:
    this.resetResources = function(moofoll) {
      for (let i = 0; i < config.resourceTypes.length; ++i) {
        this[config.resourceTypes[i]] = moofoll ? 100 : 0;
      }
    };
    // ADD ITEM:
    this.getItemType = function(id) {
      let findindx = this.items.findIndex((ids) => ids == id);
      if (findindx != -1) {
        return findindx;
      } else {
        return items.checkItem.index(id, this.items);
      }
    };
    // SET DATA:
    this.setData = function(data) {
      this.id = data[0];
      this.sid = data[1];
      this.name = data[2];
      this.x = data[3];
      this.y = data[4];
      this.dir = data[5];
      this.health = data[6];
      this.maxHealth = data[7];
      this.scale = data[8];
      this.skinColor = data[9];
    };

    this.update = function(delta) {
      if (this.active) {
        // MOVE:
        let gear = {
          skin: findID(hats, this.skinIndex),
          tail: findID(accessories, this.tailIndex)
        }
        let spdMult = ((this.buildIndex >= 0) ? 0.5 : 1) * (items.weapons[this.weaponIndex].spdMult || 1) * (gear.skin ? (gear.skin.spdMult || 1) : 1) * (gear.tail ? (gear.tail.spdMult || 1) : 1) * (this.y <= config.snowBiomeTop ? ((gear.skin && gear.skin.coldM) ? 1 : config.snowSpeed) : 1) * this.slowMult;
        this.maxSpeed = spdMult;
      }
    };
    let tmpRatio = 0;
    let animIndex = 0;
    this.animate = function(delta) {
      if (this.animTime > 0) {
        this.animTime -= delta;
        if (this.animTime <= 0) {
          this.animTime = 0;
          this.dirPlus = 0;
          tmpRatio = 0;
          animIndex = 0;
        } else {
          if (animIndex == 0) {
            tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.min(1, tmpRatio));
            if (tmpRatio >= 1) {
              tmpRatio = 1;
              animIndex = 1;
            }
          } else {
            tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
          }
        }
      }
    };
    // GATHER ANIMATION:
    this.startAnim = function(didHit, index) {
      this.animTime = this.animSpeed = items.weapons[index].speed;
      this.targetAngle = (didHit ? -config.hitAngle : -Math.PI);
      tmpRatio = 0;
      animIndex = 0;
    };
    // CAN SEE:
    this.canSee = function(other) {
      if (!other) return false;
      let dx = Math.abs(other.x - this.x) - other.scale;
      let dy = Math.abs(other.y - this.y) - other.scale;
      return dx <= (config.maxScreenWidth / 2) * 1.3 && dy <= (config.maxScreenHeight / 2) * 1.3;
    };
    // SHAME SYSTEM:
    this.judgeShame = function() {
      if (this.oldHealth < this.health) {
        if (this.hitTime) {
          let timeSinceHit = Date.now() - this.hitTime;
          this.lastHit = Date.now();
          this.hitTime = 0;
          if (timeSinceHit < 120 - SD * 2) {
            this.shameCount++;
          } else {
            this.shameCount = Math.max(0, this.shameCount - 2);
          }
        }
      } else if (this.oldHealth > this.health) {
        this.hitTime = Date.now();
      }
    };
    this.addShameTimer = function() {
      this.shameCount = 0;
      this.shameTimer = 30;
      let interval = setInterval(() => {
        this.shameTimer--;
        if (this.shameTimer <= 0) {
          clearInterval(interval);
        }
      }, 1000);
    };
    // CHECK TEAM:
    this.isTeam = function(tmpObj) {
      return (this == tmpObj || (this.team && this.team == tmpObj.team));
    };
    // FOR THE PLAYER:
    this.findAllianceBySid = function(sid) {
      return this.team ? alliancePlayers.find((THIS) => THIS === sid) : null;
    };
    this.isReloaded = function(id = this.weaponIndex) {
      return this.reloads[id] <= 0;
    }
    // UPDATE WEAPON RELOAD:
    this.manageReload = function() {
      if (this.shooting[53]) {
        this.shooting[53] = 0;
        this.reloads[53] = (2500 - game.tickRate);
      } else {
        if (this.reloads[53] > 0) {
          this.reloads[53] = Math.max(0, this.reloads[53] - game.tickRate);
        }
      }
      if (this.gathering || this.shooting[1]) {
        if (this.gathering) {
          this.gathering = 0;
          let baseSpeed = items.weapons[this.gatherIndex].speed * (this.skinIndex == 20 ? 0.78 : 1);

          if (baseSpeed > pingTime) baseSpeed -= pingTime;
          else if (baseSpeed > pingTime / 2) baseSpeed -= pingTime / 2;

          baseSpeed += SD;
          this.reloads[this.gatherIndex] = baseSpeed;
          this.attacked = true;
        }
        if (this.shooting[1]) {
          let baseSpeed = items.weapons[this.shootIndex].speed * (this.skinIndex == 20 ? 0.78 : 1);

          if (baseSpeed > pingTime) baseSpeed -= pingTime;
          else if (baseSpeed > pingTime / 2) baseSpeed -= pingTime / 2;

          baseSpeed += SD;

          this.shooting[1] = 0;
          this.reloads[this.shootIndex] = baseSpeed;
          if (this.weapons[1]) this.reloads[this.weapons[1]] = baseSpeed;
          this.attacked = true;
        }
      } else {
        this.attacked = false;
        if (this.buildIndex < 0) {
          if (this.reloads[this.weaponIndex] > 0) {
            this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - game.tickRate);
            if (this == player) {
              if (configurer.doWeaponGrind) {
                for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                  place(player.getItemType(22), i);
                }
              }
            }
          }
        }
      }
    };
  }
};
// SOME CODES:
function sendUpgrade(index) {
  player.reloads[index] = 0;
  packet("H", index);
}

function storeEquip(id, index) {
  packet("c", 0, id, index);
}

function storeBuy(id, index) {
  packet("c", 1, id, index);
}

let inbullspam = false;
let qHoldX;

function buyEquip(id, index) {
  if (!player[index ? "tails" : "skins"][id]) id = 0;
  if (player[index ? "tailIndex" : "skinIndex"] == id) return;

  if (near.dist3 < 180 && configurer.doResetInsta && id != 6 && id != 22 && !index) {
    qHoldX = true;
  } else if (qHoldX === true) qHoldX = "oneTick";
  else qHoldX = false;

  storeEquip(id, index);
  if (id == 53) player.reloads[53] = 2500;
}

function selectToBuild(index, wpn) {
  packet("z", index, wpn);
}

function selectWeapon(index, isPlace) {
  if (!isPlace) {
    player.weaponCode = index;
  }
  packet("z", index, true);
}

function sendAutoGather(force) {
  sheduleHits.addHit(force);
}

function sendAtck(id, angle) {
  packet("F", id, angle);
}
// PLACER:

let placeQueue = [];
let placedThisTick = [];

function place(id, rad, priority = 2) {
  if (!player.alive || !inGame) return;
  if (id == 0) return actualPlace(id, rad);

  const objScale = items.list[id].scale + config.playerScale;

  placeQueue.push({
    position: {
      x: player.x3 + Math.cos(rad) * objScale,
      y: player.y3 + Math.sin(rad) * objScale,
      objScale: items.list[id].scale
    },
    angle: rad,
    expires: Date.now() + pingTime,
    id
  });
}

function actualPlace(id, rad) {
  selectToBuild(player.items[id]);
  sendAtck(1, rad);
  selectWeapon(player.weaponCode);
}

function healer(extra = 1) {
  for (let i = 0; i < healthBased() + extra; i++) {
    place(0);
  }
}

function healthBased(heal = player.health) {
  if (heal == 100) return 0;
  if (player.skinIndex != 45 && player.skinIndex != 56) {
    return Math.ceil((100 - heal) / items.list[player.items[0]].healing);
  }
  return 0;
}

function findAllianceBySid(sid) {
  return player.team ? alliancePlayers.find((THIS) => THIS === sid) : null;
}

function biomeGear() {
  if (player.y3 >= config.mapScale / 2 - config.riverWidth / 2 && player.y3 <= config.mapScale / 2 + config.riverWidth / 2) {
    buyEquip(31);
    return 31;
  } else {
    if (player.y3 <= config.snowBiomeTop) {
      buyEquip(15);
      return 15;
    } else {
      buyEquip(12);
      return 12;
    }
  }
}
class Traps {
  constructor(UTILS, items) {
    this.dist = 0;
    this.aim = 0;
    this.inTrap = false;
    this.tempObjects = [];
    this.generateAngles = function*(near2, itemId, noObj, start, end) {
      this.tempObjects = this.tempObjects.filter(e => e.timestamp < Date.now());
      let objScale = items.list[player.items[itemId || 4] || player.items[2]].scale + (items.list[player.items[itemId || 4] || player.items[2]].placeOffset || 0);
      const badObjects = nearestGameObjects.concat(this.tempObjects).filter(e => e.sid != noObj && Math.hypot(player.x3 - e.x, player.y3 - e.y) <= e.scale + objScale + config.playerScale).sort((a, b) => Math.atan2(a.y - player.y3, a.x - player.x3) - Math.atan2(b.y - player.y3, b.x - player.x3));
      const temp = this.transformPosition(0, objScale + config.playerScale, player.x3, player.y3);

      for (let i = start; i < end; ) {
        const obj = this.transformPosition(i, objScale + config.playerScale, player.x3, player.y3);
        const { x, y } = this.transformPosition(i, objScale + config.playerScale, player.x3, player.y3);
        const collider = badObjects.find(_ => Math.hypot(_.x - x, _.y - y) < _.scale + objScale);
        if (collider) {
          const normal = Math.atan2(collider.y - player.y3, collider.x - player.x3);
          const radius = collider.scale;
          const edge = {
            x: collider.x + Math.cos(normal + Math.PI / 2) * radius,
            y: collider.y + Math.sin(normal + Math.PI / 2) * radius
          }
          const alpha = Math.atan2(edge.y - player.y3, edge.x - player.x3);
          const beta = Math.atan2(
            edge.y - player.y3 + objScale * Math.sin(Math.PI / 2 + alpha),
            edge.x - player.x3 + objScale * Math.cos(Math.PI / 2 + alpha)
          );
          const dist = Math.abs(UTILS.getAngleDist(i, beta));

          i += Math.max(dist, 0.00001);
        } else {
          const endPoint = {
            x: obj.x + Math.cos(i + Math.PI / 2) * objScale,
            y: obj.y + Math.sin(i + Math.PI / 2) * objScale
          }

          const beta = Math.atan2(endPoint.y - player.y3, endPoint.x - player.x3) + Math.PI * 2;
          i += Math.abs(UTILS.getAngleDist(i, beta));
        };

        if (badObjects.find(_ => Math.hypot(_.x - obj.x, _.y - obj.y) < _.scale + objScale)) continue;

        yield i;

        badObjects.push({ x, y, scale: objScale });
        this.tempObjects.push({ x, y, scale: objScale, timestamp: Date.now() + game.tickRate + window.pingTime / 2 + SD });
      }
    }
    this.checkKill = function(angle, inTrap) {
      const obj = this.transformPosition(angle, 50 + config.playerScale, player.x3, player.y3);
      const obj1 = this.transformPosition(angle, 45 + config.playerScale, player.x3, player.y3);
      const conditions = Math.hypot(obj1.x - near.x3, obj1.y - near.y3) < config.playerScale + 45 ||
        (inTrap && near.dist3 < config.playerScale * 2 + 45);
      this.ez = conditions;

      return conditions;
    }
    this.autoPlace = function(noObj, objSid_ = null, start = 0, end = Math.PI * 2, force = false, onlyAngles = false) {
      if ((enemy.length && enemy[0].dist2 < 600 && configurer.doAutoPlace) || force) {
        let near2 = {
          inTrap: false,
        };
        let nearTrap = gameObjects.filter(e => e.trap && e.active && e.isTeamObject(player) && UTILS.getDist(e, near, 0, 2) <= (near.scale + e.getScale() + 5)).sort(function(a, b) {
          return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
        })[0];
        if (nearTrap) {
          near2.inTrap = true;
        } else {
          near2.inTrap = false;
        }
        if (player.y3 >= config.mapScale / 2 - config.riverWidth / 2 && player.y3 <= config.mapScale / 2 + config.riverWidth / 2) return;

        const objSid = objSid_ || ((near2.inTrap || (player.isReloaded(player.weapons[0]))) && near.dist2 < items.weapons[player.weaponIndex].range + config.playerScale ? 2 : 4);
        const angleGen = this.generateAngles(near2, objSid, noObj, start, end);

        let maxPlace = 4;
        let val = null;

        if (onlyAngles) return [...angleGen];
        else {
          while (maxPlace-- > 0 && !(val = angleGen.next()).done) place(objSid_ || (this.checkKill(val.value, near2.inTrap) ? 2 : (player.items[4] ? 4 : 2)), val.value, 1);
        }
      }
    };
    this.transformPosition = function(angle, step, x1, y1) {
      return {
        x: x1 + Math.cos(angle) * step,
        y: y1 + Math.sin(angle) * step
      }
    }
    this.replacer = function(obj) {
      if (!inGame || configurer.doWeaponGrind) return;
      if (near.dist2 > 180 || !near?.dist2) return;

      const angle = Math.atan2(obj.y - player.y3, obj.x - player.x3);

      const angles = traps.autoPlace(obj.sid, null, angle - Math.PI / 3, angle + Math.PI / 3, false, true);

      if (!angles?.length) return;

      const anglePerfect = angles.sort((a, b) => Math.abs(a - angle) - Math.abs(b - angle))[0];

      place(2, anglePerfect);
    };
  }
}

class Autobuy {
  constructor(buyHat, buyAcc) {
    this.hat = function() {
      buyHat.forEach((id) => {
        let find = findID(hats, id);
        if (find && !player.skins[id] && player.points >= find.price) packet("c", 1, id, 0);
      });
    };
    this.acc = function() {
      buyAcc.forEach((id) => {
        let find = findID(accessories, id);
        if (find && !player.tails[id] && player.points >= find.price) packet("c", 1, id, 1);
      });
    };
  }
};
let UTILS = new Utils();
let items = new Items();
let objectManager = new Objectmanager(GameObject, gameObjects, UTILS, config);
let store = new Store();
let hats = store.hats;
let accessories = store.accessories;
let projectileManager = new ProjectileManager(Projectile, projectiles, players, ais, objectManager, items, config, UTILS);
let traps = new Traps(UTILS, items);
let spikes = {
  aim: 0,
  inRange: false,
  info: {}
}
let autoBuy = new Autobuy([15, 31, 6, 7, 12, 11, 26, 53, 40], [11, 21]);

function sendChat(message) {
  packet("6", message.slice(0, 30));
}
addEventListener("mousemove", gameInput, true);
let mouseAngle = 0;
function gameInput(e) {
  mouseX = e.clientX;
  mouseY = e.clientY;

  mouseAngle = Math.atan2(window.innerHeight / 2 - mouseY, window.innerWidth / 2 - mouseX);
}
let clicks = {
  left: false,
  middle: false,
  right: false,
};
addEventListener("mousedown", mouseDown, true);
addEventListener("resize", () => {
  screenWidth = window.innerWidth;
  screenHeight = window.innerHeight;
}, true);

function mouseDown(e) {
  if (e.target.id != "touch-controls-fullscreen" && e.target.id != "gameCanvas") return;
  if (attackState != 1) {
    attackState = 1;
    if (e.button == 0) {
      clicks.left = true;
    } else if (e.button == 1) {
      clicks.middle = true;
    } else if (e.button == 2) {
      clicks.right = true;
    }

    e.preventDefault();
    e.stopImmediatePropagation();
  }
}
addEventListener("mouseup", mouseUp, true);

function mouseUp(e) {
  if (attackState != 0) {
    attackState = 0;
    if (e.button == 0) {
      clicks.left = false;
    } else if (e.button == 1) {
      clicks.middle = false;
    } else if (e.button == 2) {
      clicks.right = false;
    }
  }
}

// INPUT UTILS:
function getMoveDir() {
  let dx = 0;
  let dy = 0;
  for (let key in moveKeys) {
    let tmpDir = moveKeys[key];
    dx += !!keys[key] * tmpDir[0];
    dy += !!keys[key] * tmpDir[1];
  }
  return dx == 0 && dy == 0 ? null : Math.atan2(dy, dx);
}

function getSafeDir() {
  lastDir = inbullspam ? near.aim : Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
  return lastDir;
}

function getAttackDir(debug) {
  if (configurer.do360Hit && (player?.weaponCode != player.weapons[1] && player.weapons[1] != 10) && !my.autoAim) return Number.MAX_VALUE;
  else if (my.autoAim || ((clicks.left || (near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap)))) lastDir = configurer.doWeaponGrind ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
  else if (clicks.right0) lastDir = getSafeDir();
  else if (spikes.inRange && configurer.doAutoBreakSpike) lastDir = spikes.aim;
  else if (traps.inTrap) lastDir = traps.aim;
  else lastDir = getSafeDir();
  return lastDir;
}
// KEYS:
function keysActive() {
  return document.activeElement.tagName != "INPUT";
}

let waitInsta = false;
let reverseInsta = false;

function keyDown(event) {
  let keyNum = event.which || event.keyCode || 0;
  if (player && player.alive && keysActive()) {
    if (!keys[keyNum]) {
      keys[keyNum] = 1;
      macro[event.key] = 1;
      if (keyNum == 67) {
        updateMapMarker();
      } else if (player.weapons[keyNum - 49] != undefined) {
        player.weaponCode = [...player.weapons][keyNum - 49];
      } else if (event.key == "m") {
        mills.placeSpawnPads = !mills.placeSpawnPads;
      } else if (event.key == "z") {
        millC.active = !millC.active;
      } else if (event.key == "r") {
        if (typeof waitInsta == "number") waitInsta = false;
        else waitInsta = 0;
      } else if (event.key == "t") {
        if (typeof reverseInsta == "number") reverseInsta = false;
        else reverseInsta = 0;
      }
    }
  }
}
addEventListener("keydown", UTILS.checkTrusted(keyDown));

function keyUp(event) {
  if (event.code == "ShiftRight") client_menu.style.display = client_menu.style.display == "block" ? "none" : "block";
  if (player && player.alive) {
    let keyNum = event.which || event.keyCode || 0;
    if (keysActive()) {
      if (keys[keyNum]) {
        keys[keyNum] = 0;
        macro[event.key] = 0;
      }
    }
  }
}
window.addEventListener("keyup", UTILS.checkTrusted(keyUp));

// AUTOPUSH:
function autoPush() {
  let nearTrap = nearestGameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 5)).sort(function(a, b) {
    return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
  })[0];
  if (nearTrap) {
    let spike = nearestGameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, nearTrap, 0, 0) <= (near.scale + nearTrap.scale + tmp.scale)).sort(function(a, b) {
      return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
    })[0];
    if (spike) {
      let pos = {
        x: spike.x + (250 * Math.cos(UTILS.getDirect(near, spike, 2, 0))),
        y: spike.y + (250 * Math.sin(UTILS.getDirect(near, spike, 2, 0))),
        x2: spike.x + ((UTILS.getDist(near, spike, 2, 0) + player.scale) * Math.cos(UTILS.getDirect(near, spike, 2, 0))),
        y2: spike.y + ((UTILS.getDist(near, spike, 2, 0) + player.scale) * Math.sin(UTILS.getDirect(near, spike, 2, 0)))
      };
      let finds = nearestGameObjects.filter(tmp => tmp.active).find((tmp) => {
        let tmpScale = tmp.getScale();
        if (!tmp.ignoreCollision && UTILS.lineInRect(tmp.x - tmpScale, tmp.y - tmpScale, tmp.x + tmpScale, tmp.y + tmpScale, player.x2, player.y2, pos.x2, pos.y2)) {
          return true;
        }
      });
      if (finds) {
        if (my.autoPush) {
          my.autoPush = false;
          packet("f", lastMoveDir || null);
        }
      } else {
        my.autoPush = true;
        let scale = (player.scale / 10);
        if (UTILS.lineInRect(player.x2 - scale, player.y2 - scale, player.x2 + scale, player.y2 + scale, near.x2, near.y2, pos.x, pos.y)) {
          packet("f", near.aim2);
        } else {
          packet("f", UTILS.getDirect(pos, player, 2, 2));
        }
      }
    } else {
      if (my.autoPush) {
        my.autoPush = false;
        packet("f", lastMoveDir || null);
      }
    }
  } else {
    if (my.autoPush) {
      my.autoPush = false;
      packet("f", lastMoveDir || null);
    }
  }
}
// SET INIT DATA:
function setInitData(data) {
  alliances = data.teams;
}
// SETUP GAME:
function setupGame(yourSID) {
  keys = {};
  macro = {};
  playerSID = yourSID;
  attackState = 0;
  inGame = true;
  my.ageInsta = true;
  if (firstSetup) {
    firstSetup = false;
    gameObjects.length = 0;
  }
}
// ADD NEW PLAYER:
function addPlayer(data, isYou) {
  let tmpPlayer = findPlayerByID(data[0]);
  if (!tmpPlayer) {
    tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager, objectManager, players, ais, items, hats, accessories);
    players.push(tmpPlayer);
  }
  tmpPlayer.spawn(isYou ? true : null);
  tmpPlayer.visible = false;
  tmpPlayer.x2 = undefined;
  tmpPlayer.y2 = undefined;
  tmpPlayer.x3 = undefined;
  tmpPlayer.y3 = undefined;
  tmpPlayer.setData(data);
  if (isYou) {
    player = tmpPlayer;
    camX = player.x;
    camY = player.y;
    my.lastDir = 0;
    updateItems();
    updateAge();
  }
}
// REMOVE PLAYER:
function removePlayer(id) {
  for (let i = 0; i < players.length; i++) {
    if (players[i].id == id) {
      players.splice(i, 1);
      break;
    }
  }
}
// UPDATE HEALTH:
function updateHealth(sid, value) {
  tmpObj = findPlayerBySID(sid);
  if (tmpObj) {
    if (tmpObj.sid == playerSID) {
      player.healTimestamp = Date.now();
      player.outhealed = false;
    }
    tmpObj.oldHealth = tmpObj.health;
    tmpObj.health = value;
    tmpObj.judgeShame();
  }
}

let lastDmgPot = 0;

function updateQueue() {
  placeQueue = placeQueue.filter(e => Date.now() < e.expires);
  placedThisTick = placedThisTick.filter(e => Date.now() < e.expires);

  const limited = Math.trunc((108 - packetsCount) / 3);

  placeQueue.sort(_ => _.priority).splice(0, Math.min(4, limited)).forEach(_ => {
    if (nearestGameObjects.find(e => Math.hypot(_.position.x - e.x, _.position.y - e.y) < e.scale + _.position.objScale) && _.priority != 0) return;
    actualPlace(_.id, _.angle);

    placedThisTick.push({
      x: _.position.x,
      y: _.position.y,
      scale: _.position.objScale,
      expires: game.tickRate * 2 + window.pingTime + SD
    });
  });
}

setInterval(() => {
  if ((Date.now() - player?.healTimestamp > 121 + SD - pingTime) && !player?.outhealed) {
    player.outhealed = true;
    healer(1);
  }

  if (!game.ticksResynced && Date.now() - game.tickResync <= 7) {
    game.ticksResynced = true;
    onUpdate();
  }
}, 1);
setInterval(() => packetsCount = 0, 1000);
// KILL PLAYER:
function killPlayer() {
  inGame = false;
}
// UPDATE PLAYER ITEM VALUES:
function updateItemCounts(index, value) {
  if (player) {
    player.itemCounts[index] = value;
  }
}
// UPDATE AGE:
function updateAge(xp, mxp, age) {
  if (xp != undefined) player.XP = xp;
  if (mxp != undefined) player.maxXP = mxp;
  if (age != undefined) player.age = age;
}
// UPDATE UPGRADES:
function updateUpgrades(points, age) {
  player.upgradePoints = points;
  player.upgrAge = age;
}
// KILL OBJECT:
function killObject(sid) {
  findObjectBySid(sid) && traps.replacer(findObjectBySid(sid));
  objectManager.disableBySid(sid);
  if (player) {
    for (let i = 0; i < gameObjects.length; i++) {
      if (gameObjects[i].sid == sid) {
        gameObjects.splice(i, 1);
        break;
      }
    }
  }
}

function handleData() {
  if (gameObjects.length) {
    gameObjects.forEach((tmp) => {
      tmp.onNear = false;
      if (tmp.active) {
        if (!tmp.onNear && UTILS.getDist(tmp, player, 0, 2) <= tmp.scale + items.weapons[player.weapons[0]].range) {
          tmp.onNear = true;
        }
        if (tmp.isItem && tmp.owner) {
          if (!tmp.pps && player.sid == tmp.owner.sid && UTILS.getDist(tmp, player, 0, 2) > 0 && !tmp.breakObj && ![13, 14, 20].includes(tmp.id)) {
            tmp.breakObj = true;
            breakObjects.push({
              x: tmp.x,
              y: tmp.y,
              sid: tmp.sid
            });
          }
        }
      }
    });
    let nearTrap = nearestGameObjects.filter(e => e.trap && e.active && UTILS.getDist(e, player, 0, 2) <= (player.scale + e.getScale() + 5) && !e.isTeamObject(player)).sort(function(a, b) {
      return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
    })[0];
    if (nearTrap) {
      let spike = nearestGameObjects.filter(e => (/spik/.test(e.name || e.dmg) && e.active && UTILS.getDist(e, player, 0, 3) <= player.scale + e.scale + 20 && !e.isTeamObject(player))).sort((a, b) => {
        return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
      })[0];
      traps.inTrap = true;
      traps.dist = UTILS.getDist(nearTrap, player, 0, 3);
      traps.info = nearTrap;
      if (spike) {
        if (configurer.doAntiPush) {
          if (traps.info.health > spike.health) {
            traps.aim = UTILS.getDirect(spike, player, 0, 2);
          } else {
            traps.aim = UTILS.getDirect(nearTrap, player, 0, 2);
          }
        } else {
          traps.aim = UTILS.getDirect(nearTrap, player, 0, 2);
        }
      } else {
        traps.aim = UTILS.getDirect(nearTrap, player, 0, 2);
      }
    } else {
      traps.inTrap = false;
      traps.info = {};
    }
    let spike = nearestGameObjects.filter(e => (/spik/.test(e.name || e.dmg) && e.active && UTILS.getDist(e, player, 0, 3) <= player.scale + e.scale + calculateVelocity(player) && !e.isTeamObject(player))).sort((a, b) => {
      return UTILS.getDist(a, player, 0, 3) - UTILS.getDist(b, player, 0, 3);
    })[0];
    if (spike) {
      spikes.aim = UTILS.getDirect(spike, player, 0, 3);
      spikes.inRange = true;
    } else {
      spikes.inRange = false;
    }
  } else {
    traps.inTrap = false;
    spikes.inRange = false;
  }
}

function shootTurret(sid, dir) {
  tmpObj = findObjectBySid(sid);
  if (tmpObj) {
    tmpObj.dir = dir;
    tmpObj.shootted = 1;
  }
}

// KILL ALL OBJECTS BY A PLAYER:
function killObjects(sid) {
  if (player) objectManager.removeAllItems(sid);
}
let oldXY = {
  x: undefined,
  y: undefined,
};
// UPDATE PLAYER DATA:
function calculateVelocity(player) {
  if (typeof player.moveDir != "number") return 0;

  const hatMult = findID(store.hats, player.skinIndex)?.spdMult || 1;
  const accMult = findID(store.accessories, player.tailIndex)?.spdMult || 1;
  const wepMult = findID(items.weapons, player.weaponIndex)?.spdMult || 1;
  let base = 0;

  if (player.y2 < config.snowBiomeTop) base += config.snowSpeed;
  else base += config.playerSpeed;

  base *= hatMult;
  base *= accMult;
  base *= wepMult;

  let xVel = Math.cos(player.moveDir);
  let yVel = Math.sin(player.moveDir);
  let magnitude = Math.hypot(xVel, yVel);

  xVel /= magnitude;
  yVel /= magnitude;

  const velocity = Math.hypot(xVel, yVel) * game.tickRate * base;
  return velocity;
};

let virtualSkin = 0;
let doNotEquip = false;

const hatChanger = function(_) {
  if (game.onlySoldier) return game.onlySoldier = false;
  const old = virtualSkin;
  if (player.shameCount > 1 && (!(clicks.left || clicks.right || traps.inTrap) || !player.isReloaded(player.weaponIndex))) {
    virtualSkin = 7;
  } else if ((clicks.left || clicks.right || traps.inTrap) && player.isReloaded(player.weaponIndex) && !_) {
    virtualSkin = (configurer.doWeaponGrind || clicks.right || traps.inTrap) ? 40 : 7;
  } else if (configurer.doConstaSoldier) {
    virtualSkin = 6;
  } else if (near.dist2 < 180 && near.reloads[0] == 0 && player.health >= 95 && lastDmgPot < 60) {
    virtualSkin = 11;
  } else {
    if (traps.inTrap) virtualSkin = 26;
    else virtualSkin = biomeGear();
  }

  buyEquip(virtualSkin);

  return virtualSkin == old;
}

let virtualTail = 0;
const accChanger = function() {
  const shouldPrimAcc = (clicks.left ||
       inbullspam ||
       near.dist2 < 180 || typeof waitInsta == "number");
  if (shouldPrimAcc) {
    virtualTail = player.tails[21] ? 21 : 0;
  } else if (!shouldPrimAcc) {
    virtualTail = 11;
  }

  buyEquip(virtualTail, true);
  return player.tailIndex == virtualTail;
};
let lastPing = 0;
let pingTime = 50;
let pings = [0, 0, 0];
let SD = 0;

const ping = document.createElement("p");

ping.innerHTML = "";
ping.style = "z-index: 999; position: fixed; bottom: 250px; left: 0; color: white; font-size: 18px !important";

document.documentElement.appendChild(ping);

function updatePing() {
  if (pings.length > 3) pings = pings.slice(1);

  pingTime = Date.now() - lastPing;
  pings.push(pingTime);

  const mu = pings.reduce((a, b) => a + b, 0) / pings.length;
  SD = 0;
  for (const _ of pings) SD += (_ - mu) * (_ - mu);
  SD = Math.min(pingTime, Math.sqrt(SD));
}
setInterval(() => {
  packet("0");
  lastPing = Date.now();
}, 2000);

let nearestGameObjects = [];
let packetsCount = 0;
let nears = [];

function updatePlayers(data) {
  const ticksClamp = Math.ceil(pingTime / 111);
  game.ticksResynced = false;
  game.tick++;
  near = [];
  enemy = [];
  game.tickSpeed = performance.now() - game.lastTick;
  game.lastTick = performance.now();
  game.tickResync = Date.now() + 111;
  nearestGameObjects = gameObjects.filter(obj => Math.hypot(obj.x - player.x3, obj.y - player.y3) < 1000);
  if (configurer.doPacketSpin) packet("D", Math.cos(Date.now()) * 6.28);
  if (configurer.doResetInsta && qHoldX) {
    if (qHoldX === true) {
      place(0);
      place(0);

      qHoldX = false;
    } else qHoldX = true;
  }
  ping.innerHTML = `Ping ${Math.floor(pingTime)}, Deviation ${Math.floor(SD)} <br>
  Shame ${player.shameCount} <br>
  Server lag ${(function() {
    const lag = Math.floor(game.serverLag / 111 * 100);
    if (lag < 10) return "<font color = \"green\"> Ok </font>";
    else if (lag < 30) return "<font color = \"darkgreen\"> Playable </font>";
    else if (lag < 55) return "<font color = \"yellow\"> Medium </font>";
    else if (lag < 70) return "<font color = \"orange\"> Hard </font>";
    else return "<font color = \"red\"> EXTREME </font>"
  })()} <br>
  Kickability ${Math.floor(packetsCount / 120 * 100)}% <br>
  Dmgpot ${lastDmgPot} <br>
  WR Insta: ${waitInsta} ${reverseInsta} <br>
  Placements queue: ${placeQueue.length}, ${(placeQueue.length - 4) < 0 ? "Stable" : "Trail " + (placeQueue.length - 4)}`;

  for (let i = 0; i < data.length;) {
    tmpObj = findPlayerBySID(data[i]);
    if (tmpObj) {
      if (!tmpObj.isTeam(player)) enemy.push(tmpObj);
      tmpObj.t1 = (tmpObj.t2 === undefined) ? game.lastTick : tmpObj.t2;
      tmpObj.t2 = game.lastTick;
      tmpObj.x1 = tmpObj.x;
      tmpObj.y1 = tmpObj.y;
      tmpObj.dt = 0;
      tmpObj.x2 = data[i + 1];
      tmpObj.y2 = data[i + 2];
      tmpObj.moveDir = tmpObj.sid == playerSID ? getMoveDir() : Math.atan2(tmpObj.y2 - tmpObj.y1, tmpObj.x2 - tmpObj.x1);
      tmpObj.x3 = tmpObj.x2 + (configurer.usePredictions ? ((Math.cos(tmpObj.moveDir) * calculateVelocity(tmpObj) * ticksClamp) || 0) : 0);
      tmpObj.y3 = tmpObj.y2 + (configurer.usePredictions ? ((Math.sin(tmpObj.moveDir) * calculateVelocity(tmpObj) * ticksClamp) || 0) : 0);
      tmpObj.d1 = (tmpObj.d2 === undefined) ? data[i + 3] : tmpObj.d2;
      tmpObj.d2 = data[i + 3];
      tmpObj.buildIndex = data[i + 4];
      tmpObj.weaponIndex = data[i + 5];
      tmpObj.weaponVariant = data[i + 6];
      tmpObj.team = data[i + 7];
      tmpObj.isLeader = data[i + 8];
      tmpObj.oldSkinIndex = tmpObj.skinIndex;
      tmpObj.oldTailIndex = tmpObj.tailIndex;
      tmpObj.skinIndex = data[i + 9];
      tmpObj.tailIndex = data[i + 10];
      tmpObj.iconIndex = data[i + 11];
      tmpObj.zIndex = data[i + 12];
      tmpObj.visible = true;
      tmpObj.update(game.tickSpeed);
      tmpObj.dist2 = UTILS.getDist(tmpObj, player, 2, 2);
      tmpObj.aim2 = UTILS.getDirect(tmpObj, player, 2, 2);
      tmpObj.dist3 = UTILS.getDist(tmpObj, player, 3, 3);
      tmpObj.aim3 = UTILS.getDirect(tmpObj, player, 3, 3);
      if (tmpObj == player) {
        (!millC.x || !oldXY.x) && (millC.x = oldXY.x = tmpObj.x2);
        (!millC.y || !oldXY.y) && (millC.y = oldXY.y = tmpObj.y2);
        handleData()
      } else {
        if (tmpObj.weaponIndex > 7) tmpObj.weapons[1] = tmpObj.weaponIndex;
        else tmpObj.weapons[0] = tmpObj.weaponIndex;
      }
      if (tmpObj.skinIndex == 45 && tmpObj.shameTimer <= 0) {
        tmpObj.addShameTimer();
      }
      if (tmpObj.oldSkinIndex == 45 && tmpObj.skinIndex != 45) {
        tmpObj.shameTimer = 0;
        tmpObj.shameCount = 0;
        if (tmpObj == player) {
          healer();
        }
      }
      tmpObj.manageReload();
    }
    i += 13;
  }
  if (player && player.alive) {
    if (enemy.length) {
      near = enemy.sort(function(tmp1, tmp2) {
        return tmp1.dist2 - tmp2.dist2;
      })[0];
      nears = enemy.sort(function(tmp1, tmp2) {
        return tmp1.dist2 - tmp2.dist2;
      });
    }
    players.forEach((tmp) => {
      if (!tmp.visible && player != tmp) {
        tmp.reloads = {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
          6: 0,
          7: 0,
          8: 0,
          9: 0,
          10: 0,
          11: 0,
          12: 0,
          13: 0,
          14: 0,
          15: 0,
          53: 0,
        };
      }
    });
  }
}

let poisonDebuffs = [];
let lastPot = 0;

function checkPotHit() {
  return player.isReloaded(player.weaponCode) || near.isReloaded(near.weapons[0]) || near.isReloaded(near.weapons[1]);
}

function onUpdate() {
  const ticksClamp = Math.ceil(pingTime / 111);

  near.x3 = near.x2 + (Math.cos(near.moveDir) * calculateVelocity(near) * ticksClamp) || 0;
  near.y3 = near.y2 + (Math.sin(near.moveDir) * calculateVelocity(near) * ticksClamp) || 0;

  player.x3 = player.x2 + (configurer.usePredictions ? ((Math.cos(player.moveDir) * calculateVelocity(player) * ticksClamp) || 0) : 0);
  player.y3 = player.y2 + (configurer.usePredictions ? ((Math.sin(player.moveDir) * calculateVelocity(player) * ticksClamp) || 0) : 0);

  nearestGameObjects.forEach(obj => {
    if (near.dist2 > 180 ||
        Math.hypot(obj.x - player.x3, obj.y - player.y3) > config.playerScale + obj.scale) return;

    const angle = Math.atan2(obj.y - player.y3, obj.x - player.x3);

    const angles = traps.autoPlace(obj.sid, null, angle - Math.PI / 3, angle + Math.PI / 3, false, true);

    if (!angles?.length) return;

    const anglePerfect = angles.sort((a, b) => Math.abs(a - angle) - Math.abs(b - angle))[0];

    place(2, anglePerfect, 0);
  });

  doNotEquip = false;

  if (inGame) {
    macro.q && place(0, getAttackDir());
    macro.f && place(4, getSafeDir());
    macro.v && place(2, getSafeDir());
    macro.y && place(5, getSafeDir());
    macro.h && place(player.getItemType(22), getSafeDir());
    macro.n && place(3, getSafeDir());

    let objectSize = millC.size(items.list[player.items[3]].scale);
    let objectDist = millC.dist(items.list[player.items[3]].scale);

    if (millC.active) {
      const millsPlaced = nearestGameObjects.filter(e => Math.hypot(e.x - player.x1, e.y - player.y1) < e.scale + config.playerScale);
      const millsBroken = millsPlaced.length < 3;
      const nearestBrokenPosition = millsPlaced.sort((a, b) => Math.hypot(a.x - player.x3, a.y - player.y3) - Math.hypot(b.x - player.x3, b.y - player.y3))[0];

      if (Math.hypot(millC.x - player.x3, millC.y - player.y3) >= (millsBroken ? 2 : 1) * items.list[player.items[3]].scale + config.playerScale / 2) {
        place(3, player.moveDir - Math.PI - 1.2);
        place(3, player.moveDir - Math.PI + 1.2);
        place(3, player.moveDir - Math.PI);

        millC.count = Math.max(0, millC.count - 1);
        millC.x = player.x3;
        millC.y = player.y3;
      }
    }

    if (mills.placeSpawnPads) {
      traps.autoPlace(null, player.getItemType(20), 0, Math.PI * 2, true);
    }

    traps.autoPlace();


    if ((near && near.skinIndex != 6) && typeof waitInsta == "number" && player.isReloaded(player.weapons[0]) && player.isReloaded(player.weapons[1]) && (near.dist2 < items.weapons[player.weapons[0]].range + config.playerScale || waitInsta > 0)) {
      waitInsta = (+waitInsta) + 1;
      my.autoAim = true;

      if (waitInsta == 1) {
        selectWeapon(player.weapons[0]);
        buyEquip(7);
        sendAutoGather();
      } else if (waitInsta == 2) {
        selectWeapon(player.weapons[1]);
        buyEquip(53);
        sendAutoGather();
        waitInsta = false;
        my.autoAim = false;
      }
    } else if ((near && near.skinIndex != 6) && typeof reverseInsta == "number" && player.isReloaded(player.weapons[0]) && player.isReloaded(player.weapons[1]) && (near.dist2 < items.weapons[player.weapons[0]].range + config.playerScale || reverseInsta > 0)) {
      reverseInsta = (+reverseInsta) + 1;
      my.autoAim = true;

      if (reverseInsta == 2) {
        selectWeapon(player.weapons[0]);
        buyEquip(7);
        sendAutoGather();

        reverseInsta = false;
        my.autoAim = false;
      } else if (reverseInsta == 1) {
        selectWeapon(player.weapons[1]);
        buyEquip(53);
        sendAutoGather();
      }
    }

    if (storeMenu.style.display != "block") {
      accChanger() && hatChanger();
    }
    if (configurer.doAutoPush && enemy.length && tmpObj.skinIndex != 45) {
      autoPush();
    } else {
      if (my.autoPush) {
        my.autoPush = false;
        packet("f", lastMoveDir || null);
      }
    }
  }

  if (pathbot) { // a bit of syntactic sugar
    let baseAngle = (mouseAngle || Math.atan2(pathbot.x - player.x3, pathbot.y - player.y3)) - Math.PI;
    let obj;

    if (!!(obj = nearestGameObjects.find(e => Math.hypot(player.x3 - e.x, player.y3 - e.y) <= config.playerScale + e.scale))) {
      const left = traps.transformPosition(-Math.PI / 2, obj.scale, obj.x, obj.y);
      const right = traps.transformPosition(Math.PI / 2, obj.scale, obj.x, obj.y);

      if (Math.hypot(left.x - player.x3, left.y - player.y3) < Math.hypot(right.x - player.x3, right.y - player.y3)) {
        baseAngle += Math.atan2(left.x - player.x3, left.y - player.y3) + Math.PI / 3;
      } else baseAngle -= Math.atan2(right.x - player.x3, right.y - player.y3) + Math.PI / 3;
    }

    packet("f", baseAngle);
  }

  if (!inGame || !player || !player?.alive) return;
  updateQueue();

  const correctWeapon = traps.inTrap ? (player.weapons[1] == 10 ? 10 : player.weapons[0]) :
  (clicks.right || clicks.left) ?
        ((clicks.right && player.weapons[1] == 10 && !traps.ez) ? player.weapons[1] : player.weapons[0]) :
  (!player.isReloaded(player.weapons[1]) ? player.weapons[1] : !player.isReloaded(player.weapons[0]) ? player.weapons[0] :
  (player.weapons[1] == 10 ? 10 : player.weapons[0]));

  if (player.weaponIndex != correctWeapon || player.buildIndex > -1) {
    selectWeapon(correctWeapon);
  }

  if (!clicks.middle && (clicks.left || clicks.right)) {
    if (player.isReloaded(player.weaponIndex) || player.isReloaded(correctWeapon) || traps.ez) {
      if (accChanger()) {
        hatChanger();

        traps.ez = false;
        sendAutoGather();
      }
    }
  }

  if (traps.inTrap) {
    if (player.isReloaded(correctWeapon) && hatChanger()) {
      sendAutoGather();
    }
  }

  if (player.isReloaded() && sheduleHits_.includes(game.tick)) sheduleHits_.addHit();
}

// LOAD GAME OBJECT:
function loadGameObject(data) {
  for (let i = 0; i < data.length;) {
    objectManager.add(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4], data[i + 5], items.list[data[i + 6]], true, (data[i + 7] >= 0 ? {
      sid: data[i + 7]
    } : null));
    i += 8;
  }
}
// GATHER ANIMATION:
function gatherAnimation(sid, didHit, index) {
  tmpObj = findPlayerBySID(sid);
  if (tmpObj) {
    tmpObj.startAnim(didHit, index);
    tmpObj.gatherIndex = index;
    tmpObj.gathering = 1;
    if (didHit) {
      tmpObj = findPlayerBySID(sid);
      if (tmpObj?.sid == near?.sid && config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]]?.id >= 3) {
        poisonDebuffs[game.tick] = true;
        poisonDebuffs[game.tick + 5] = true;
        poisonDebuffs[game.tick + 10] = true;
        poisonDebuffs[game.tick + 15] = true;
        poisonDebuffs[game.tick + 20] = true;
      }

      let val = items.weapons[index].dmg * (config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]]?.val || 1) * (items.weapons[index]?.sDmg || 1) * (virtualSkin == 40 && player.skins[40] ? 3.3 : 1);
      for (let i = 0; i < gameObjects.length; i++) {
        const obj = gameObjects[i];
        const baseAngle = Math.atan2(obj.y - tmpObj.y3, obj.x - tmpObj.x3);

        if (Math.hypot(tmpObj.x3 - obj.x, tmpObj.y3 - obj.y) > items.weapons[index].range + config.playerScale) continue;
        obj.health -= val;
      };
    }
  }
}

// UPDATE PLAYER VALUE:
function updatePlayerValue(index, value, updateView) {
  if (player) {
    player[index] = value;
    if (index == "points") {
      if (configurer.doAutoBuy) {
        autoBuy.hat();
        autoBuy.acc();
      }
    }
  }
}
// ACTION BAR:
function updateItems(data, wpn) {
  if (data) {
    if (wpn) {
      player.weapons = data;
      player.weaponCode = data[0];
    } else {
      player.items = data;
    }
  }
}
// ADD PROJECTILE:
function addProjectile(x, y, dir, range, speed, indx, layer, sid) {
  projectileManager.addProjectile(x, y, dir, range, speed, indx, null, null, layer, true).sid = sid;

  const player_ = players.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).filter(e => e.weapons[1] != 10)[0];
  if (!player_) return;
  
  player_.shooting[1] = true;
}
// REMOVE PROJECTILE:
function remProjectile(sid, range) {
  for (let i = 0; i < projectiles.length; ++i) {
    if (projectiles[i].sid == sid) {
      projectiles[i].range = range;
      let tmpObjects = objectManager.hitObj;
      objectManager.hitObj = [];
      let val = projectiles[i].dmg;
      tmpObjects.forEach((healthy) => {
        if (healthy.projDmg) {
          healthy.health -= val;
        }
      });
    }
  }
}
// SHOW ALLIANCE MENU:
function setPlayerTeam(team, isOwner) {
  if (player) {
    player.team = team;
    player.isOwner = isOwner;
    if (team == null) alliancePlayers = [];
  }
}

function setAlliancePlayers(data) {
  alliancePlayers = data;
}
// STORE MENU:
function updateStoreItems(type, id, index) {
  if (index) {
    if (!type) {
      player.tails[id] = 1;
    } else {
      player.latestTail = id;
    }
  } else {
    if (!type) {
      player.skins[id] = 1;
    } else {
      player.latestSkin = id;
    }
  }
}

let pathbot;

function pathfinder(coords) {
  const x = parseInt(coords.split(",")[0]);
  const y = parseInt(coords.split(",")[1]);

  pathbot = { x, y };
}

function createText(txt) {
  const el = document.createElement("p");

  el.innerHTML = txt;
  el.style = "font-size: 14px !important; color: white";

  return el;
}

// SEND MESSAGE:
function receiveChat(sid, message) {
  const tmpPlayer = findPlayerBySID(sid);
  document.getElementById("chatHolder").prepend(createText(`[${tmpPlayer.name}] ${message}`));
  if (playerSID != sid) {
    if (message.toLowerCase().includes("ez")) sendChat("ur mom ez");
    else if (message.toLowerCase().includes("noob")) sendChat("kys Nigger");
    else if (message.toLowerCase().includes("bad")) sendChat("ur anal bad");
  };

  switch (message.split(" ")[0]) {
    case "!km":
      [5, 17, 31, 27, 10, 38, 4, 15].forEach(sendUpgrade);
      break;
    case "!ph":
      [5, 17, 31, 27, 10, 38].forEach(sendUpgrade);
      break;
    case "!kh":
      [3, 17, 31, 23, 10, 38, 4, 25].forEach(sendUpgrade);
      break;
    case "!find":
      pathfinder(message.split(" ")[1]);
      break;
  }
}
