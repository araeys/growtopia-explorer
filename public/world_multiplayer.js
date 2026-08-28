/**
 * GTWorldMultiplayer - Ultra-Reliable Real-Time Peer-to-Peer Multiplayer Engine
 * Powered by Native WebRTC DataChannels with Global MQTT Signaling & Zero Server Lag
 * 
 * Original creator and developer: Raey (@araeys / @aryhaan)
 * Repository: https://github.com/araeys/growtopia-explorer
 */

(function (global) {
  "use strict";

  const MQTT_BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt"
  ];

  const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" }
  ];

  // Room Code generator: GT-[4 character alphanumeric]
  function generateRoomCode() {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `GT-${code}`;
  }

  function cleanRoomCode(input) {
    if (!input) return "";
    let code = String(input).toUpperCase().trim();
    if (!code.startsWith("GT-") && code.length === 4) {
      code = "GT-" + code;
    }
    return code;
  }

  function getPureCode(code) {
    const cleaned = cleanRoomCode(code);
    return cleaned.replace(/^GT-/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  // Fast Run-Length Encoding (RLE) for ultra-compact world data (< 2KB over WebRTC)
  function compressLayerRLE(arr) {
    if (!arr || arr.length === 0) return [];
    const rle = [];
    let currentVal = arr[0];
    let count = 1;

    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === currentVal) {
        count++;
      } else {
        rle.push(currentVal, count);
        currentVal = arr[i];
        count = 1;
      }
    }
    rle.push(currentVal, count);
    return rle;
  }

  function decompressLayerRLE(rle, expectedLength) {
    const out = new Uint16Array(expectedLength);
    if (!rle || !Array.isArray(rle)) return out;
    let outIdx = 0;
    for (let i = 0; i < rle.length; i += 2) {
      const val = rle[i];
      const count = rle[i + 1] || 1;
      for (let c = 0; c < count && outIdx < expectedLength; c++) {
        out[outIdx++] = val;
      }
    }
    return out;
  }

  function decompressFlagsRLE(rle, expectedLength) {
    const out = new Uint8Array(expectedLength);
    if (!rle || !Array.isArray(rle)) return out;
    let outIdx = 0;
    for (let i = 0; i < rle.length; i += 2) {
      const val = rle[i];
      const count = rle[i + 1] || 1;
      for (let c = 0; c < count && outIdx < expectedLength; c++) {
        out[outIdx++] = val;
      }
    }
    return out;
  }

  function createMultiplayerClient(engine) {
    let mqttClient = null;
    let peerClient = null;
    let roomCode = "";
    let isHost = false;
    let localPeerId = "user_" + Math.random().toString(36).slice(2, 9);
    let isConnected = false;
    const connections = new Map(); // peerId -> RTCDataChannel / DataConnection
    const peerConnections = new Map(); // peerId -> RTCPeerConnection
    const remotePlayers = new Map(); // peerId -> player state object
    let sendTickTimer = null;

    const eventCallbacks = {
      onStatus: null,
      onConnect: null,
      onDisconnect: null,
      onPlayerJoin: null,
      onPlayerLeave: null,
      onChatMessage: null,
      onTileUpdate: null
    };

    function notifyStatus(msg, type = "info") {
      if (typeof eventCallbacks.onStatus === "function") {
        eventCallbacks.onStatus(msg, type);
      }
    }

    function getLocalPlayerProfile() {
      const pName = (engine && typeof engine.getPlayerName === "function") ? engine.getPlayerName() : "Raey";
      const pSkin = (engine && typeof engine.getPlayerSkin === "function") ? engine.getPlayerSkin() : "classic";
      const pSkinColor = (engine && typeof engine.getPlayerSkinColor === "function") ? engine.getPlayerSkinColor() : "#ffc3aa";
      const pMod = (engine && typeof engine.isModeratorMode === "function") ? engine.isModeratorMode() : false;
      return { name: pName, skin: pSkin, skinColor: pSkinColor, isMod: pMod };
    }

    // Direct WebRTC broadcast across all open DataChannels
    function broadcast(packet, excludePeerId = null) {
      const dataStr = typeof packet === "string" ? packet : JSON.stringify(packet);
      connections.forEach((channel, peerId) => {
        if (peerId !== excludePeerId && channel && channel.readyState === "open") {
          try {
            channel.send(dataStr);
          } catch (e) {}
        }
      });
    }

    // Direct WebRTC send to specific peer
    function sendTo(peerId, packet) {
      const channel = connections.get(peerId);
      if (channel && channel.readyState === "open") {
        try {
          channel.send(typeof packet === "string" ? packet : JSON.stringify(packet));
        } catch (e) {}
      }
    }

    function handleIncomingData(fromPeerId, rawData) {
      try {
        const msg = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
        if (!msg || !msg.type) return;

        switch (msg.type) {
          case "HELLO": {
            // New player joined
            const remoteP = {
              id: fromPeerId,
              name: msg.profile ? msg.profile.name : "Player",
              skin: msg.profile ? msg.profile.skin : "classic",
              skinColor: msg.profile ? msg.profile.skinColor : "#ffc3aa",
              moderatorMode: Boolean(msg.profile && msg.profile.isMod),
              x: Number(msg.x || 0),
              y: Number(msg.y || 0),
              targetX: Number(msg.x || 0),
              targetY: Number(msg.y || 0),
              vx: 0,
              vy: 0,
              width: 24,
              height: 28,
              facing: msg.facing || 1,
              state: "idle",
              animTimer: 0,
              isDead: false,
              chatMessage: "",
              chatTimer: 0,
              afkAction: null,
              isHost: false,
              ping: 25
            };
            remotePlayers.set(fromPeerId, remoteP);

            if (isHost) {
              // Host responds with ultra-compact RLE WORLD_SYNC
              const worldState = engine.getWorldState();

              sendTo(fromPeerId, {
                type: "WORLD_SYNC",
                world: {
                  width: worldState.width,
                  height: worldState.height,
                  name: worldState.name,
                  weather: worldState.weather,
                  fgRLE: compressLayerRLE(worldState.fg),
                  bgRLE: compressLayerRLE(worldState.bg),
                  flagsRLE: compressLayerRLE(worldState.flags),
                  paintRLE: worldState.paint ? compressLayerRLE(worldState.paint) : null
                },
                hostProfile: getLocalPlayerProfile(),
                peers: Array.from(remotePlayers.entries()).map(([pId, rp]) => ({
                  id: pId,
                  name: rp.name,
                  skin: rp.skin,
                  skinColor: rp.skinColor,
                  isMod: rp.moderatorMode
                }))
              });

              // Notify other existing peers
              broadcast({
                type: "PLAYER_JOINED",
                peerId: fromPeerId,
                profile: msg.profile,
                x: msg.x,
                y: msg.y
              }, fromPeerId);
            }

            if (typeof eventCallbacks.onPlayerJoin === "function") {
              eventCallbacks.onPlayerJoin(fromPeerId, remoteP);
            }
            notifyStatus(`${remoteP.name} entered the world!`, "success");
            break;
          }

          case "WORLD_SYNC": {
            // Guest receives world sync from host
            if (!isHost && msg.world) {
              const totalTiles = msg.world.width * msg.world.height;
              const fg = msg.world.fgRLE ? decompressLayerRLE(msg.world.fgRLE, totalTiles) : new Uint16Array(msg.world.fg || totalTiles);
              const bg = msg.world.bgRLE ? decompressLayerRLE(msg.world.bgRLE, totalTiles) : new Uint16Array(msg.world.bg || totalTiles);
              const flags = msg.world.flagsRLE ? decompressFlagsRLE(msg.world.flagsRLE, totalTiles) : new Uint8Array(msg.world.flags || totalTiles);
              const paint = msg.world.paintRLE ? decompressLayerRLE(msg.world.paintRLE, totalTiles) : (msg.world.paint ? new Uint16Array(msg.world.paint) : null);

              engine.loadCustomWorldState({
                width: msg.world.width,
                height: msg.world.height,
                name: msg.world.name,
                weather: msg.world.weather,
                fg,
                bg,
                flags,
                paint
              });

              // Add host to remote players
              const hostP = {
                id: fromPeerId,
                name: msg.hostProfile ? msg.hostProfile.name : "Host",
                skin: msg.hostProfile ? msg.hostProfile.skin : "classic",
                skinColor: msg.hostProfile ? msg.hostProfile.skinColor : "#ffc3aa",
                moderatorMode: Boolean(msg.hostProfile && msg.hostProfile.isMod),
                x: 0,
                y: 0,
                targetX: 0,
                targetY: 0,
                vx: 0,
                vy: 0,
                width: 24,
                height: 28,
                facing: 1,
                state: "idle",
                animTimer: 0,
                isDead: false,
                chatMessage: "",
                chatTimer: 0,
                afkAction: null,
                isHost: true,
                ping: 25
              };
              remotePlayers.set(fromPeerId, hostP);

              // Add existing peers
              if (Array.isArray(msg.peers)) {
                msg.peers.forEach(p => {
                  if (p.id && p.id !== localPeerId && !remotePlayers.has(p.id)) {
                    remotePlayers.set(p.id, {
                      id: p.id,
                      name: p.name || "Player",
                      skin: p.skin || "classic",
                      skinColor: p.skinColor || "#ffc3aa",
                      moderatorMode: Boolean(p.isMod),
                      x: 0,
                      y: 0,
                      targetX: 0,
                      targetY: 0,
                      vx: 0,
                      vy: 0,
                      width: 24,
                      height: 28,
                      facing: 1,
                      state: "idle",
                      animTimer: 0,
                      isDead: false,
                      chatMessage: "",
                      chatTimer: 0,
                      afkAction: null,
                      isHost: false,
                      ping: 25
                    });
                  }
                });
              }

              notifyStatus(`Connected to World (${msg.world.width}x${msg.world.height})!`, "success");
            }
            break;
          }

          case "PLAYER_JOINED": {
            if (msg.peerId && msg.peerId !== localPeerId) {
              const remoteP = {
                id: msg.peerId,
                name: msg.profile ? msg.profile.name : "Player",
                skin: msg.profile ? msg.profile.skin : "classic",
                skinColor: msg.profile ? msg.profile.skinColor : "#ffc3aa",
                moderatorMode: Boolean(msg.profile && msg.profile.isMod),
                x: Number(msg.x || 0),
                y: Number(msg.y || 0),
                targetX: Number(msg.x || 0),
                targetY: Number(msg.y || 0),
                vx: 0,
                vy: 0,
                width: 24,
                height: 28,
                facing: 1,
                state: "idle",
                animTimer: 0,
                isDead: false,
                chatMessage: "",
                chatTimer: 0,
                afkAction: null,
                isHost: false,
                ping: 25
              };
              remotePlayers.set(msg.peerId, remoteP);
              notifyStatus(`${remoteP.name} joined!`, "info");
            }
            break;
          }

          case "PLAYER_TICK": {
            const p = remotePlayers.get(fromPeerId);
            if (p) {
              p.targetX = Number(msg.x);
              p.targetY = Number(msg.y);
              p.vx = Number(msg.vx || 0);
              p.vy = Number(msg.vy || 0);
              p.facing = Number(msg.facing || 1);
              p.state = msg.state || "idle";
              p.skin = msg.skin || p.skin;
              p.skinColor = msg.skinColor || p.skinColor;
              p.moderatorMode = Boolean(msg.isMod);
              p.isDead = Boolean(msg.isDead);
              p.afkAction = msg.afkAction || null;
              p.punchTimer = Number(msg.punchTimer || 0);
              p.placeTimer = Number(msg.placeTimer || 0);
              p.jumpSpinTimer = Number(msg.jumpSpinTimer || 0);
              p.jumpThrustTimer = Number(msg.jumpThrustTimer || 0);
              if (msg.name) p.name = msg.name;
              if (msg.chatMessage) {
                p.chatMessage = msg.chatMessage;
                p.chatTimer = Number(msg.chatTimer || 5.0);
              }
            }
            if (isHost) {
              broadcast(msg, fromPeerId);
            }
            break;
          }

          case "TILE_SET": {
            if (msg.x !== undefined && msg.y !== undefined) {
              engine.setTileNetwork(msg.x, msg.y, msg.item, { isBg: msg.isBg, flip: msg.flip });
              if (isHost) broadcast(msg, fromPeerId);
            }
            break;
          }

          case "TILE_ERASE": {
            if (msg.x !== undefined && msg.y !== undefined) {
              engine.eraseTileNetwork(msg.x, msg.y);
              if (isHost) broadcast(msg, fromPeerId);
            }
            break;
          }

          case "FLOOD_FILL": {
            if (msg.x !== undefined && msg.y !== undefined) {
              engine.floodFillNetwork(msg.x, msg.y, msg.item);
              if (isHost) broadcast(msg, fromPeerId);
            }
            break;
          }

          case "WEATHER_SET": {
            if (msg.weatherId) {
              engine.setWeatherNetwork(msg.weatherId);
              if (isHost) broadcast(msg, fromPeerId);
            }
            break;
          }

          case "CHAT": {
            if (msg.name && msg.text) {
              const p = remotePlayers.get(fromPeerId);
              if (p) {
                p.chatMessage = msg.text;
                p.chatTimer = 5.5;
              }
              if (typeof eventCallbacks.onChatMessage === "function") {
                eventCallbacks.onChatMessage(fromPeerId, msg.name, msg.text);
              }
              if (isHost) broadcast(msg, fromPeerId);
            }
            break;
          }

          case "PORTAL_FX": {
            if (msg.x !== undefined && msg.y !== undefined && typeof engine.triggerEntranceAnimation === "function") {
              engine.triggerEntranceAnimation(msg.x, msg.y);
              if (isHost) broadcast(msg, fromPeerId);
            }
            break;
          }
        }
      } catch (e) {
        console.error("Multiplayer packet error:", e);
      }
    }

    function setupDataChannel(channel, peerId) {
      connections.set(peerId, channel);

      channel.onopen = () => {
        isConnected = true;
        const localPos = engine.getPlayerPosition();
        const profile = getLocalPlayerProfile();
        sendTo(peerId, {
          type: "HELLO",
          profile,
          x: localPos.x,
          y: localPos.y,
          facing: localPos.facing
        });
        startTickLoop();
      };

      channel.onmessage = (event) => {
        handleIncomingData(peerId, event.data);
      };

      channel.onclose = () => {
        handlePeerDisconnect(peerId);
      };

      channel.onerror = () => {
        handlePeerDisconnect(peerId);
      };
    }

    function handlePeerDisconnect(peerId) {
      const p = remotePlayers.get(peerId);
      if (p) {
        notifyStatus(`${p.name} disconnected.`, "info");
        remotePlayers.delete(peerId);
        if (typeof eventCallbacks.onPlayerLeave === "function") {
          eventCallbacks.onPlayerLeave(peerId);
        }
      }
      connections.delete(peerId);
      const pc = peerConnections.get(peerId);
      if (pc) {
        try { pc.close(); } catch (e) {}
        peerConnections.delete(peerId);
      }
      if (isHost) {
        broadcast({ type: "PLAYER_LEFT", peerId });
      }
    }

    // 30Hz rate-limited broadcast of local player state
    function startTickLoop() {
      if (sendTickTimer) clearInterval(sendTickTimer);
      sendTickTimer = setInterval(() => {
        if (!isConnected || connections.size === 0) return;
        const pos = engine.getPlayerPosition();
        const profile = getLocalPlayerProfile();

        const tickData = {
          type: "PLAYER_TICK",
          x: Math.round(pos.x * 10) / 10,
          y: Math.round(pos.y * 10) / 10,
          vx: Math.round(pos.vx * 10) / 10,
          vy: Math.round(pos.vy * 10) / 10,
          facing: pos.facing,
          state: pos.state,
          skin: profile.skin,
          skinColor: profile.skinColor,
          isMod: profile.isMod,
          isDead: pos.isDead,
          afkAction: pos.afkAction,
          punchTimer: Math.round((pos.punchTimer || 0) * 100) / 100,
          placeTimer: Math.round((pos.placeTimer || 0) * 100) / 100,
          jumpSpinTimer: Math.round((pos.jumpSpinTimer || 0) * 100) / 100,
          jumpThrustTimer: Math.round((pos.jumpThrustTimer || 0) * 100) / 100,
          chatMessage: pos.chatMessage || "",
          chatTimer: Math.round((pos.chatTimer || 0) * 10) / 10,
          name: profile.name
        };

        broadcast(tickData);
      }, 33);
    }

    // Connect to global MQTT signaling network
    function connectMqttSignaling() {
      const mqttLib = (typeof window !== "undefined" && window.mqtt) ? window.mqtt : null;
      if (!mqttLib) {
        return Promise.reject(new Error("MQTT client library not loaded"));
      }

      if (mqttClient && mqttClient.connected) {
        return Promise.resolve(mqttClient);
      }

      return new Promise((resolve, reject) => {
        let currentIdx = 0;
        function tryNextBroker() {
          if (currentIdx >= MQTT_BROKERS.length) {
            reject(new Error("Unable to connect to WebRTC signaling brokers"));
            return;
          }

          const brokerUrl = MQTT_BROKERS[currentIdx];
          const client = mqttLib.connect(brokerUrl, {
            clientId: "gt_p2p_" + Math.random().toString(16).slice(2, 10),
            clean: true,
            connectTimeout: 5000,
            reconnectPeriod: 3000
          });

          client.on("connect", () => {
            mqttClient = client;
            resolve(client);
          });

          client.on("error", () => {
            client.end(true);
            currentIdx++;
            tryNextBroker();
          });
        }

        tryNextBroker();
      });
    }

    // Host Room
    function hostRoom(customCode = null) {
      disconnect();
      const code = cleanRoomCode(customCode || generateRoomCode());
      const pureId = getPureCode(code);
      roomCode = code;
      isHost = true;
      localPeerId = "host_" + pureId;

      notifyStatus(`Opening Room ${code}...`, "info");

      return connectMqttSignaling().then((mqtt) => {
        const topicOffer = `gt-exp-v1/room/${pureId}/offer`;
        const topicIce = `gt-exp-v1/room/${pureId}/ice/to-host`;

        mqtt.subscribe([topicOffer, topicIce], { qos: 1 });

        mqtt.on("message", (topic, message) => {
          try {
            const data = JSON.parse(message.toString());
            if (!data) return;

            if (topic === topicOffer && data.guestId && data.offer) {
              const guestId = data.guestId;
              let pc = peerConnections.get(guestId);
              if (pc) pc.close();

              pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
              peerConnections.set(guestId, pc);

              pc.ondatachannel = (e) => {
                setupDataChannel(e.channel, guestId);
              };

              pc.onicecandidate = (e) => {
                if (e.candidate) {
                  mqtt.publish(`gt-exp-v1/room/${pureId}/ice/to-guest/${guestId}`, JSON.stringify({
                    candidate: e.candidate
                  }));
                }
              };

              pc.setRemoteDescription(new RTCSessionDescription(data.offer)).then(() => {
                return pc.createAnswer();
              }).then((answer) => {
                return pc.setLocalDescription(answer);
              }).then(() => {
                mqtt.publish(`gt-exp-v1/room/${pureId}/answer/${guestId}`, JSON.stringify({
                  answer: pc.localDescription
                }), { qos: 1 });
              }).catch((err) => {
                console.error("Host WebRTC answer error:", err);
              });
            } else if (topic === topicIce && data.guestId && data.candidate) {
              const pc = peerConnections.get(data.guestId);
              if (pc && pc.remoteDescription) {
                pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
              }
            }
          } catch (err) {
            console.error("Signaling parse error:", err);
          }
        });

        isConnected = true;
        notifyStatus(`Room ${code} is open! Keep this tab open for friends to join.`, "success");
        if (typeof eventCallbacks.onConnect === "function") {
          eventCallbacks.onConnect(code, true);
        }
        return code;
      });
    }

    // Join Room
    function joinRoom(inputCode) {
      disconnect();
      const code = cleanRoomCode(inputCode);
      const pureId = getPureCode(code);
      if (!code || !pureId) {
        notifyStatus("Please enter a valid room code (e.g. GT-8A92)", "error");
        return Promise.reject(new Error("Invalid room code"));
      }

      roomCode = code;
      isHost = false;
      const guestId = "guest_" + Math.random().toString(36).slice(2, 9);
      localPeerId = guestId;

      notifyStatus(`Connecting to Room ${code}...`, "info");

      return new Promise((resolve, reject) => {
        let isResolved = false;
        const joinTimeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            notifyStatus(`Could not reach Host (${code}). Make sure the Host tab is open!`, "error");
            disconnect();
            reject(new Error(`Timeout: Host room ${code} not reachable`));
          }
        }, 10000);

        connectMqttSignaling().then((mqtt) => {
          const topicAnswer = `gt-exp-v1/room/${pureId}/answer/${guestId}`;
          const topicIce = `gt-exp-v1/room/${pureId}/ice/to-guest/${guestId}`;

          mqtt.subscribe([topicAnswer, topicIce], { qos: 1 });

          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          peerConnections.set("host", pc);

          const channel = pc.createDataChannel("gt-multiplayer", { ordered: true });
          setupDataChannel(channel, "host");

          channel.onopen = () => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(joinTimeout);
              isConnected = true;
              notifyStatus(`Joined Room ${code} successfully!`, "success");
              startTickLoop();
              if (typeof eventCallbacks.onConnect === "function") {
                eventCallbacks.onConnect(code, false);
              }
              resolve(code);
            }
          };

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              mqtt.publish(`gt-exp-v1/room/${pureId}/ice/to-host`, JSON.stringify({
                guestId,
                candidate: e.candidate
              }));
            }
          };

          mqtt.on("message", (topic, message) => {
            try {
              const data = JSON.parse(message.toString());
              if (topic === topicAnswer && data.answer) {
                pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch((err) => {
                  console.error("Guest setRemoteDescription error:", err);
                });
              } else if (topic === topicIce && data.candidate) {
                pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
              }
            } catch (e) {}
          });

          pc.createOffer().then((offer) => {
            return pc.setLocalDescription(offer);
          }).then(() => {
            mqtt.publish(`gt-exp-v1/room/${pureId}/offer`, JSON.stringify({
              guestId,
              offer: pc.localDescription
            }), { qos: 1 });
          }).catch((err) => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(joinTimeout);
              reject(err);
            }
          });
        }).catch((err) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(joinTimeout);
            reject(err);
          }
        });
      });
    }

    function disconnect() {
      if (sendTickTimer) {
        clearInterval(sendTickTimer);
        sendTickTimer = null;
      }
      connections.forEach((conn) => {
        try { conn.close(); } catch (e) {}
      });
      connections.clear();
      peerConnections.forEach((pc) => {
        try { pc.close(); } catch (e) {}
      });
      peerConnections.clear();
      remotePlayers.clear();
      if (mqttClient) {
        try { mqttClient.end(true); } catch (e) {}
        mqttClient = null;
      }
      const wasConnected = isConnected;
      isConnected = false;
      roomCode = "";
      isHost = false;
      if (wasConnected && typeof eventCallbacks.onDisconnect === "function") {
        eventCallbacks.onDisconnect();
      }
    }

    // Broadcast helpers for world changes
    function broadcastTileSet(x, y, item, options = {}) {
      if (!isConnected) return;
      broadcast({
        type: "TILE_SET",
        x,
        y,
        item,
        isBg: options.isBg,
        flip: options.flip
      });
    }

    function broadcastTileErase(x, y) {
      if (!isConnected) return;
      broadcast({
        type: "TILE_ERASE",
        x,
        y
      });
    }

    function broadcastFloodFill(x, y, item) {
      if (!isConnected) return;
      broadcast({
        type: "FLOOD_FILL",
        x,
        y,
        item
      });
    }

    function broadcastWeatherSet(weatherId) {
      if (!isConnected) return;
      broadcast({
        type: "WEATHER_SET",
        weatherId
      });
    }

    function broadcastChat(text) {
      const profile = getLocalPlayerProfile();
      if (!isConnected) return;
      broadcast({
        type: "CHAT",
        name: profile.name,
        text
      });
    }

    function broadcastEntranceFx(x, y) {
      if (!isConnected) return;
      broadcast({
        type: "PORTAL_FX",
        x,
        y
      });
    }

    // Smooth remote players interpolation (called every render frame at 60fps)
    function updateRemotePlayers(dt) {
      remotePlayers.forEach((p) => {
        const lerpFactor = Math.min(1.0, dt * 14.0);
        p.x += (p.targetX - p.x) * lerpFactor;
        p.y += (p.targetY - p.y) * lerpFactor;
        p.animTimer += dt;
        if (p.chatTimer > 0) p.chatTimer = Math.max(0, p.chatTimer - dt);
        if (p.punchTimer > 0) p.punchTimer = Math.max(0, p.punchTimer - dt);
        if (p.placeTimer > 0) p.placeTimer = Math.max(0, p.placeTimer - dt);
        if (p.jumpSpinTimer > 0) p.jumpSpinTimer = Math.max(0, p.jumpSpinTimer - dt);
        if (p.jumpThrustTimer > 0) p.jumpThrustTimer = Math.max(0, p.jumpThrustTimer - dt);
      });
    }

    return {
      hostRoom,
      joinRoom,
      disconnect,
      broadcastTileSet,
      broadcastTileErase,
      broadcastFloodFill,
      broadcastWeatherSet,
      broadcastChat,
      broadcastEntranceFx,
      updateRemotePlayers,
      getRemotePlayers: () => remotePlayers,
      getConnections: () => connections,
      isConnected: () => isConnected,
      isHost: () => isHost,
      getRoomCode: () => roomCode,
      setCallbacks: (cbs) => Object.assign(eventCallbacks, cbs)
    };
  }

  global.GTWorldMultiplayer = {
    generateRoomCode,
    cleanRoomCode,
    getPureCode,
    compressLayerRLE,
    decompressLayerRLE,
    decompressFlagsRLE,
    createMultiplayerClient
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.GTWorldMultiplayer;
  }
})(typeof window !== "undefined" ? window : globalThis);
