// ==UserScript==
// @name         Emerald Recode
// @version      2.8
// @description  A better version of emerald
// @author       0xffabc
// @license      MIT
// @match        *://*.kogama.com/page/webgl-frame/*
// @match        *://*.kogama.com.br/page/webgl-frame/*
// @run-at       document-start
// ==/UserScript==

const wsServers = [];
const sockets = [];
let gamePlayers = [];
const push = Array.prototype.push;
const foreach = Array.prototype.forEach;
const uint8array = Uint8Array;
const uint32array = Uint32Array;
const uint16array = Uint16Array;
const float32array = Float32Array;
let normalizedSurface = 0;
const symbol = Symbol("onmessage");
let dragging = false;
let position;
let dX;
let dY;
let playerSid = 0;

function wsServer(datas) {
    wsServers.forEach(function (wsServer) {
        wsServer(datas);
    });
}

function to32xConvertedByte(n) {
    return new uint8array(new uint32array([n]).buffer).reverse();
}

function to16xConvertedByte(n) {
    return new uint8array(new uint16array([n]).buffer).reverse();
}

function to32xConvertedFloat(n) {
    return new uint8array(new float32array([n]).buffer);
}

function findDoubles(array) {
    const doubles = [];
    const getDouble = () => array.indexOf(102);
    const doublesCount = array.filter(e => e == 102).length;

    for (let i = 0; i < doublesCount; i++) {
        const doubleIndex = getDouble();
        const double = new Uint8Array([
            array[doubleIndex + 4],
            array[doubleIndex + 3],
            array[doubleIndex + 2],
            array[doubleIndex + 1]]).buffer;
        doubles.push({
            double: new Float32Array(double)[0],
            startIndex: doubleIndex + 1
        });
    };

    return doubles;
};

HTMLElement.prototype.requestFullscreen = new Proxy(HTMLElement.prototype.requestFullscreen, {
    apply(target, that, args) {
        return Reflect.apply(target, document.documentElement, args);
    }
});

Object.defineProperty(WebSocket.prototype, "onmessage", {
    get() {
        return this[symbol];
    }, set(callback) {
        this[symbol] = callback;
        this.addEventListener("message", callback);
        packets.notification("Hooked peer connection at " + this.url);
        this.addEventListener("message", function(packet) {
            const packet_ = new Uint8Array(packet.data);
            const arr = new Uint8Array(event.data);
            switch (packet_[2]) {
                case 61:
                    const players = String.fromCharCode.apply(null,
                                                              packet_);
                    document.querySelector("#players").innerHTML = players;
                    gamePlayers = [...new Set(players.match(/(\d+)/gm).filter(e => e.length == 6))];
                    gamePlayers.forEach(player => {
                        const e = document.createElement("option");
                        e.innerHTML = player;
                        e.value = player;
                        document.querySelector("#select1").append(e);
                    });

                    playerSid = parseInt(players.split(":")[1].replace(',"spawnRoleAvatarIds"', ""));
                    break;
                case 2:
                    const doubles = findDoubles(arr);
                    const index = arr.indexOf(doubles[1].startIndex);
                    const index1 = arr.indexOf(doubles[0].startIndex);
                    const mySid = to32xConvertedByte(playerSid);
                    top.packets.motionY = ~~doubles[1].double / normalizedSurface;
                    normalizedSurface = normalizedSurface * 0.5 + (~~doubles[1].double) * 0.5;

                    document.querySelector("#playerCoords").innerHTML = `(${~~doubles[0].double}; ${~~doubles[1].double}; ${~~doubles[2].double})`;

                    if (top.flightY) {
                        const yCoord = parseInt(top.flightY) + 0.1;
                        const _ = to32xConvertedFloat(yCoord || 0.1);

                        arr[index] = _[0];
                        arr[index + 1] = _[1];
                        arr[index + 2] = _[2];
                        arr[index + 3] = _[3];

                        return wsServer({
                            data: arr.buffer
                        });
                    } else if (top.yPort) {
                        top.packets.yPort();
                    }
            }
            return false;

        });

        wsServers.push(callback);
        sockets.push(this);
    }
});

const client_menu = document.createElement("div");
client_menu.style = [
    "position: fixed",
    "color: #fff",
    "z-index: 100",
    "top: 10%",
    "right: 10%",
    "font-weight: slim",
    "font-family: 'Roboto'",
    "scrollbar-color: #fff #fff",
    "user-select: none"
].join(";");
client_menu.innerHTML = `
    <link href='https://fonts.googleapis.com/css?family=Roboto' rel='stylesheet'>

    <div style="width: 440px; height: 300px; border-top: 3px solid; background: rgba(0, 0, 0, 0.45); border-top: 5px solid rgb(0, 180, 0); color: #fff; position: absolute; top: 25%; right: 25%; font-family: Arial; font-size: 20px">
    <span style="position: absolute; top: 10px; left: 30px; color: #fff">Emerald</span>
    <span style="position: absolute; top: 15px; right: 25px; font-size: 15px" onclick="this.parentElement.style.visibility='hidden'">x</span>
    <div style="font-size: 18px; position: absolute; top: 45px; left: 28px">
      <span class = "kogama__" onclick="[...document.querySelectorAll('column')].forEach(e => e.style.display='none'); [...document.querySelectorAll('column')][0].style.display='block'">Weapons</span>
      <span class = "kogama__" onclick="[...document.querySelectorAll('column')].forEach(e => e.style.display='none'); [...document.querySelectorAll('column')][1].style.display='block'">Players</span>
      <span onclick="[...document.querySelectorAll('column')].forEach(e => e.style.display='none'); [...document.querySelectorAll('column')][2].style.display='block'">Game</span>
      <span onclick="[...document.querySelectorAll('column')].forEach(e => e.style.display='none'); [...document.querySelectorAll('column')][3].style.display='block'">Info</span>
      <span onclick="[...document.querySelectorAll('column')].forEach(e => e.style.display='none'); [...document.querySelectorAll('column')][4].style.display='block'">Logging</span>
      <span onclick="[...document.querySelectorAll('column')].forEach(e => e.style.display='none'); [...document.querySelectorAll('column')][5].style.display='block'">Cubes</span>
    </div>
    <div style="width: 80%; height: 60%; position: absolute; top: 25%; left: 9%; border: 3px solid; border-color: rgba(0, 0, 0, 0.5); overflow-y: scroll; scrollbar-width: none">
      <inner style="position: absolute; top: 5px; left: 5px; font-size: 15px">
        <column>
        <span onclick = "top.packets.cube_gun(playerSid, top.packets.cubeID)"> Cube-Gun </span>
       <span onclick = "top.packets.impulse_gun()"> Impulse Gun </span>
       <span onclick = "top.packets.bazooka()"> Bazooka</span> <br>
       <span onclick = "top.packets.pistols()">Double Revoliers </span>
       <span onclick = "top.packets.heal_gun()"> Heal Gun</span><br>
       <span onclick = "top.packets.central()"> Colt 45</span>
       <span onclick = "top.packets.shotgun()"> Shotgun</span><br>
       <span onclick = "top.packets.shuriken()"> Shuriken</span>
       <span onclick = "top.packets.rail()"> Rail</span>
       <span onclick = "top.packets.sword()"> Sword </span> <br>
       <span onclick = "top.packets.growthgun()"> Slapgun Spawner </span>
       <span onclick = "top.packets.pistol()"> Pistol </span> <br>
       <span onclick = "top.packets.rapidon()"> Rapid Fire + Infinity </span><br>
        </column>
        <column style="display: none">
        <span onclick = "top.packets.immortality()"> Buble</span>
       <span onclick = "top.packets.impulse_tool()"> Combat Module</span><br>
       <span onclick = "top.packets.kick_all()"> Crash </span>
       <span onclick = "top.packets.antirfire()"> AntiWeapon </span>
       <span onclick = "top.packets.setHp()"> Random HP </span> <br>
       <select id = "select" style = "border: 2px solid rgb(0, 180, 0); border-top: 4px solid rgb(0, 180, 0); color: #fff; outline: 0; background: #111111">
           <option value = "none"> Disspell </option>
           <option value = "cube_gun"> CubeGun </option>
           <option value = "impulse_gun"> Impulse Gun </option>
           <option value = "bazooka"> Bazooka </option>
           <option value = "flame"> Flametower </option>
           <option value = "heal_gun"> Healer Gun </option>
           <option value = "pistols"> Pistols </option>
           <option value = "central"> Central </option>
           <option value = "shuriken"> Shuriken </option>
           <option value = "shotgun"> Shotgun </option>
           <option value = "rail"> Rail Gun </option>
           <option value = "sword"> Sword </option>
           <option value = "growthgun"> Slapgun Spawner </option>
           <option value = "rail"> Pistol (1x) </option>
           <option value = "immortality"> Buble (halfly patched) </option>
           <option value = "setScale"> Scalarity </option>
           <option value = "cube"> Spawn Yourself </option>
           <option value = "hpglitch"> Instant HP </option>
       </select> <span onclick = "top.packets.actToAll(document.querySelector('#select').value)"> Execute </span><br>
        Aggressive Crash: <select id = "select1" style = "border: 2px solid rgb(0, 180, 0); border-top: 4px solid rgb(0, 180, 0); color: #fff; outline: 0; background: #111111"></select> <span onclick = "top.packets.crash(document.querySelector('#select1').value)"> Crash! </span><br>
        </column>
        <column style="display: none">
        <span onclick = "top.packets.wasmcache()"> Clear WASM Memory </span><br>
        <span onclick = "if(this.innerHTML=='Flush WebGL Buffer: Off'){this.innerHTML='Flush WebGL Buffer: On';top.fWebgl=true}else{this.innerHTML='Flush WebGL Buffer: Off';top.fWebgl=false}"> Flush WebGL Buffer: Off </span><br>
        <span onclick = "if(this.innerHTML=='Render Type: Default'){this.innerHTML='Render Type: Multiprocessing';top.iRender=true}else if(this.innerHTML=='Render Type: Multiprocessing' && location.href.includes('kogama')){this.innerHTML='Render Type: Skip Frames';top.iRender=false;top.oRender=true}else{this.innerHTML='Render Type: Default';top.iRender=false;top.oRender=false}"> Render Type: Default </span><br>
        <span onclick = "if(this.innerHTML=='Y-Port: Off'){this.innerHTML='Y-Port: On';top.yPort=true}else{this.innerHTML='Y-Port: Off';top.yPort=false}">Y-Port: Off</span><br>
        <div class = 'no_kirka'> Flight Fixed Y: <input type = "range" min = "-100" max = "100" value = "0" onchange = "top.flightY = this.value"> </div> <br>
        Flight Fixed Y state: <input type = "checkbox" onchange = "top.flightY=this.checked"> <br>
        SpeedHack: <input type = "range" min = "0.1" max = "12" value = "6" id = "spdh">
        </column>
        <column style="display: none; word-break: break-word">
        Debugging Info <br>
        Player coords: <span id = "playerCoords">(0; 0)</span> <br>
        AntiKick called: <span id = "antikick"> 0 </span> <br>
        Players data: <span id = "players"> </span>
        By @0xffabc on YT and discord
        </column>
        <column id = "logging" style = "display: none; overflow-y: scroll; max-width: 100%; max-height: 100%; width: 100%; height: 100%; scrollbar-width: none">

        </column>
        <column style = "display: none; overflow: scroll; max-width: 100%; max-height: 100%; width: 100%; height: 100%; scrollbar-width: none">
        <span style = "font-size: 18px"> Cube-Gun tools </span> <br>
        Cube-Gun material code: <input type = "number" onchange = "top.packets.changeCubeId(this.value); top.packets.cube_gun(playerSid, top.packets.cubeID)" style = "border: 2px solid rgb(0, 180, 0); border-top: 4px solid rgb(0, 180, 0); color: #fff; outline: 0; background: #111111">
        </column>
      </inner>
    </div>
    <div style = "position: absolute; bottom: 10px; left: 30px; font-size: 15px">
        Status: Online
    </div>
    <div style = "position: absolute; bottom: 10px; right: 30px; font-size: 15px">
        @0xffabc
    </div>
</div>

    `;

client_menu.addEventListener("mousedown", e => {
    dragging = true;
    position = e;
    dX = e.clientX - parseInt(client_menu.style.left.split("px")[0]);
    dY = e.clientY - parseInt(client_menu.style.top.split("px")[0]);
});

client_menu.addEventListener("mouseup", e => {
    dragging = false;
});

client_menu.addEventListener("mousemove", e => {
    if (!dragging) return;
    client_menu.style.left = e.clientX - dX + "px";
    client_menu.style.top = e.clientY - dY + "px";
});

document.documentElement.append(client_menu);

const packets = top.packets = {
    motionY: 0,
    cubeID: 20,
    actToAll(action) {
        gamePlayers.filter(e => e.length == 6)
            .forEach(e => this[action](e, packets.cubeID));
    },
    crash(pid = 0) {
        this.none(pid);
        this.hpglitch(pid, -NaN);
        this.cube(pid, 0, 0, 0);
        this.movement(pid);
        this.none(pid);
    },
    movement(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 2, 0, 7, 22, ...to32xConvertedByte(pid), 0, 0, 0, 0, 0, 0
        ]).buffer });
    },
    fire(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 8, 105, 115, 70, 105, 114, 105, 110, 103, 111, 1, 254, 105, 0, 0, 0, 0
        ]).buffer });
    },
    changeCubeId(cubeID) {
        this.cubeID = parseInt(cubeID);
    },
    cube(pid = playerSid, x = 1, y = 1, z = 1) {
        pid = playerSid;
        wsServer({ data: new Uint8Array([
            243,4,79,0,14,24,102,...to32xConvertedFloat(x),25,102,...to32xConvertedFloat(y),26,102,...to32xConvertedFloat(z),27,102,0,0,0,0,28,102,0,0,0,0,29,102,0,0,0,0,30,102,0,0,0,0,72,121,0,3,105,...to32xConvertedByte(pid),0,0,0,0,255,255,255,255,101,111,0,20,105,0,0,0,0,128,105,0,0,0,1,58,105,255,255,255,255,92,105,255,255,255,255,254,105,0,0,0,0
        ]).buffer });
    },
    rail(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 6, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 254, 105, 0, 0, 0, 0
        ]).buffer });
        top.weapon = top.weapon = "rail";
    },
    sword(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 8, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 254, 105, 0, 0, 0, 0
        ]).buffer });
        top.weapon = top.weapon = "sword";
    },
    growthgun(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 2, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 62, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 115, 0, 9, 97, 110, 105, 109, 97, 116, 105, 111, 110, 68, 0, 0, 0, 2, 115, 0, 5, 115, 116, 97, 116, 101, 115, 0, 4, 73, 100, 108, 101, 115, 0, 9, 116, 105, 109, 101, 83, 116, 97, 109, 112, 105, 80, 15, 108, 52, 254, 105, 0, 0, 0, 0
        ]).buffer });
        top.weapon = top.weapon = "growthgun";
    },
    pistol(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 12, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 254, 105, 0, 0, 0, 0
        ]).buffer });
        top.weapon = top.weapon = "pistol";
    },
    antirfire() {
        if (top.arf_) {
            top.arf_ = false;
            clearInterval(top.arf);
            return;
        }

        top.arf_ = true;
        // most of hacks use 200 or 100 interval. reseting shots every 100ms causes them to reload weapons. 50 and more will just break at reloading.

        top.arf = setInterval(() => {
            this.actToAll("central");
            this.actToAll("none")
        }, 100);
    },
    cube_gun(pid = playerSid, id = 20) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 4, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 11, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 115, 0, 8, 105, 116, 101, 109, 68, 97, 116, 97, 68, 0, 0, 0, 1, 115, 0, 8, 109, 97, 116, 101, 114, 105, 97, 108, 98, id, 254, 105, 0, 0, 0, 0
        ]).buffer });
        top.weapon = top.weapon = "cube_gun";
    },
    kick_all(pid = playerSid) {
        wsServer(new Uint8Array([243, 2, 25, 0, 2, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 4, 115, 105, 122, 101, 102, 63, 128, 0, 0]));
    },
    impulse_gun(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 2, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 2, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 115, 0, 9, 97, 110, 105, 109, 97, 116, 105, 111, 110, 68, 0, 0, 0, 2, 115, 0, 5, 115, 116, 97, 116, 101, 115, 0, 4, 73, 100, 108, 101, 115, 0, 9, 116, 105, 109, 101, 83, 116, 97, 109, 112, 105, 70, 131, 252, 232, 254, 105, 0, 0, 0, 0
        ]).buffer });
        top.weapon = top.weapon = "impulse_gun";
    },
    bazooka(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 4, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 254, 105, 0, 0, 0, 0
        ]).buffer });
        top.weapon = top.weapon = "bazooka";
    },
    heal_gun(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 70, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 254, 105, 0, 0, 0, 0
        ]).buffer });
        top.weapon = top.weapon = "heal_gun";
    },
    pistols(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 13, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 254, 105, 0, 0, 0, 0
        ]).buffer });
        top.weapon = top.weapon = "pistols";
    },
    central(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 1, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 254, 105, 0, 0, 0, 0
        ]).buffer });
    },
    shotgun(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 9, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 254, 105, 0, 0, 0, 0
        ]).buffer });
        top.weapon = top.weapon = "shotgun";
    },
    none(pid = playerSid) {
        if (pid == playerSid) return; // prevent crashes due to webgl signature dismatch

        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 255, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 254, 105, 0, 0, 0, 0
        ]).buffer });
        top.weapon = top.weapon = "none";
    },
    flame(pid = playerSid) {
        wsServer({ data: new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 10, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 254, 105, 0, 0, 0, 0
        ]).buffer });
        top.weapon = top.weapon = "flame";
    },
    shuriken(pid = playerSid) {
        wsServer({ data:new Uint8Array([
            243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 11, 99, 117, 114, 114, 101, 110, 116, 73, 116, 101, 109, 68, 0, 0, 0, 3, 115, 0, 4, 116, 121, 112, 101, 105, 0, 0, 0, 45, 115, 0, 9, 118, 97, 114, 105, 97, 110, 116, 73, 100, 105, 0, 0, 0, 0, 115, 0, 15, 117, 112, 100, 97, 116, 101, 73, 116, 101, 109, 83, 116, 97, 116, 101, 105, 0, 0, 0, 4, 254, 105, 0, 0, 0, 0
        ]).buffer});
        top.weapon = top.weapon = "shuriken";
    },
    rapidon(pid = playerSid) {
        top.rapidFire = !top.rapidFire;
    },
    setHp(pid = playerSid) {
        if (top.sh_) {
            top.sh_ = false;
            clearInterval(top.sh);
            return;
        }

        top.sh_ = true;

        top.sh = setInterval(() => {
            this.actToAll("hpglitch");
        }, 50);
    },
    hpglitch(pid = playerSid, health = Math.random() * 100) {
        wsServer({ data: new Uint8Array([243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 6, 104, 101, 97, 108, 116, 104, 102, ...new Uint8Array(new Float32Array([health]).buffer).reverse(), 254, 105, 0, 0, 0, 0]).buffer });
        wsServer({ data: new Uint8Array([243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 9, 109, 97, 120, 72, 101, 97, 108, 116, 104, 105, ...new Uint8Array(new Float32Array([health]).buffer).reverse(), 254, 105, 0, 0, 0, 0]).buffer });
    },
    immortality(pid = playerSid) {
        wsServer({ data: new Uint8Array([243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 17, 115, 112, 97, 119, 110, 82, 111, 108, 101, 77, 111, 100, 101, 84, 121, 112, 101, 105, 0, 0, 0, 0, 254, 105, 0, 0, 0, 0]).buffer });
        wsServer({ data: new Uint8Array([243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 6, 104, 101, 97, 108, 116, 104, 102, ...new Uint8Array(new Float32Array([100]).buffer).reverse(), 254, 105, 0, 0, 0, 0]).buffer });
        wsServer({ data: new Uint8Array([243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 9, 109, 97, 120, 72, 101, 97, 108, 116, 104, 105, ...new Uint8Array(new Float32Array([100]).buffer).reverse(), 254, 105, 0, 0, 0, 0]).buffer });
        const effect_ = "SpawnProtection".split("").map(char => char.charCodeAt(0));
        wsServer({ data: new Uint8Array([243, 4, 29, 0, 3, 22, 105, ...to32xConvertedByte(pid), 70, 68, 0, 0, 0, 1, 115, 0, 9, 109, 111, 100, 105, 102, 105, 101, 114, 115, 68, 0, 0, 0, 1, 115, 0, effect_.length, 95, ...new Uint8Array(new Uint32Array(effect_).buffer), 98, 0, 254, 105, 0, 0, 0, 0]).buffer });
        Uint8Array.prototype[2] = 0;
    },
    fly(pid = playerSid) {
        top.flightun = !top.flightun;
    },
    addJumpForce() {
        document.activeElement.dispatchEvent(new KeyboardEvent("keydown", {
            keyCode: 32,
            code: "Space",
            which: 32
        }));
        setTimeout(() => {
            document.activeElement.dispatchEvent(new KeyboardEvent("keyup", {
                keyCode: 32,
                code: "Space",
                which: 32
            }));
        }, 100);
    },
    notificationOffset: 0,
    notification(text) {
        const notif = document.createElement("div");
        notif.innerHTML = text;
        notif.style = "width: 300px; text-align: center; height: 50px; z-index: 9999; background: rgba(0, 0, 0, 0.5); color: white; font-size: 20px; border-bottom: 2px solid green; position: fixed; right: 0px";
        notif.style.top = (this.notificationOffset += 70) + "px";
        document.documentElement.appendChild(notif);

        setTimeout(() => {
            this.notificationOffset -= 120;
            notif.remove();
        }, 2000);
    },
    fallingTrp: 0,
    yPort() {
        if (this.motionY > 1) { // airstrafe
            this.fallingTrp -= 0.1;
            this.motionY = -0;
            this.pistols();
            this.fire();
            this[top.weapon]();
            if (this.fallingTrp <= 0.9) { // up force < gravity
                this.notification("YPortStabilizer: Falling!");
                this.pistols();
                this.fire();
                this.fallingTrp += 0.11;
            }
        } else {
            this.notification("YPort: Adding Up Force");
            this.addJumpForce(); // onground
            this.pistols();
            this.fire();
        }
    },
    setScale(sid = playerSid) { },
    impulse_tool() {
        top.impulseTool = !top.impulseTool;
    }
};

packets.notification("Emerald initialization succeed");
