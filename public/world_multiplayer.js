/**
 * GTWorldMultiplayer - Real-Time Peer-to-Peer Multiplayer Engine for Growtopia Explorer
 * Powered by WebRTC DataChannels with Host Authority & Zero-Cost Serverless Signaling
 * 
 * Original creator and developer: Raey (@araeys / @aryhaan)
 * Repository: https://github.com/araeys/growtopia-explorer
 */

(function (global) {
  "use strict";

  const PEER_PREFIX = "gt-room-";
  const STUN_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" }
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

  function createMultiplayerClient(engine) {
    let peer = null;
    let roomCode = "";
    let isHost = false;
    let localPeerId = "";
    let isConnected = false;
    const connections = new Map(); // peerId -> DataConnection
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
      const pName = (engine && typeof engine.getPlayerName === "function") ? engine.getPlayerName() : (localStorage.getItem("gt_player_name") || "Raey");
      const pSkin = (engine && typeof engine.getPlayerSkin === "function") ? engine.getPlayerSkin() : "classic";
      const pSkinColor = (engine && typeof engine.getPlayerSkinColor === "function") ? engine.getPlayerSkinColor() : "#ffc3aa";
      const pMod = (engine && typeof engine.isModeratorMode === "function") ? engine.isModeratorMode() : false;
      return { name: pName, skin: pSkin, skinColor: pSkinColor, isMod: pMod };
    }

    // Broadcast packet to all active peer connections
    function broadcast(packet, excludePeerId = null) {
      const dataStr = typeof packet === "string" ? packet : JSON.stringify(packet);
      connections.forEach((conn, peerId) => {
        if (peerId !== excludePeerId && conn && conn.open) {
          try {
            conn.send(dataStr);
          } catch (e) {}
        }
      });
    }

    // Send packet to specific peer
    function sendTo(peerId, packet) {
      const conn = connections.get(peerId);
      if (conn && conn.open) {
        try {
          conn.send(typeof packet === "string" ? packet : JSON.stringify(packet));
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
              // Host responds with full WORLD_SYNC and list of existing peers
              const worldState = engine.getWorldState();
              sendTo(fromPeerId, {
                type: "WORLD_SYNC",
                world: {
                  width: worldState.width,
                  height: worldState.height,
                  name: worldState.name,
                  weather: worldState.weather,
                  fg: Array.from(worldState.fg),
                  bg: Array.from(worldState.bg),
                  flags: Array.from(worldState.flags),
                  paint: worldState.paint ? Array.from(worldState.paint) : null
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

              // Notify existing peers about the newcomer
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
            // Guest receives full world sync from host
            if (!isHost && msg.world) {
              engine.loadCustomWorldState({
                width: msg.world.width,
                height: msg.world.height,
                name: msg.world.name,
                weather: msg.world.weather,
                fg: new Uint16Array(msg.world.fg),
                bg: new Uint16Array(msg.world.bg),
                flags: new Uint8Array(msg.world.flags),
                paint: msg.world.paint ? new Uint16Array(msg.world.paint) : null
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
            // If host, relay tick to other peers
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

    function setupConnection(conn) {
      const peerId = conn.peer;
      connections.set(peerId, conn);

      conn.on("open", () => {
        const localPos = engine.getPlayerPosition();
        const profile = getLocalPlayerProfile();
        sendTo(peerId, {
          type: "HELLO",
          profile,
          x: localPos.x,
          y: localPos.y,
          facing: localPos.facing
        });
      });

      conn.on("data", (data) => {
        handleIncomingData(peerId, data);
      });

      conn.on("close", () => {
        handlePeerDisconnect(peerId);
      });

      conn.on("error", (err) => {
        handlePeerDisconnect(peerId);
      });
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
      if (isHost) {
        broadcast({ type: "PLAYER_LEFT", peerId });
      }
    }

    // Continuous tick loop (30Hz rate-limited broadcast of player state)
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
      }, 33); // ~30 times per second
    }

    // Host Room
    function hostRoom(customCode = null) {
      disconnect();
      const code = cleanRoomCode(customCode || generateRoomCode());
      roomCode = code;
      isHost = true;
      const fullPeerId = `${PEER_PREFIX}${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

      notifyStatus(`Creating Room ${code}...`, "info");

      const PeerClass = (typeof window !== "undefined" && window.Peer) ? window.Peer : null;
      if (!PeerClass) {
        notifyStatus("PeerJS library not loaded. Please refresh.", "error");
        return Promise.reject(new Error("PeerJS not loaded"));
      }

      return new Promise((resolve, reject) => {
        try {
          peer = new PeerClass(fullPeerId, {
            config: { iceServers: STUN_SERVERS }
          });

          peer.on("open", (id) => {
            localPeerId = id;
            isConnected = true;
            notifyStatus(`Room ${code} is open! Share the code with friends.`, "success");
            startTickLoop();
            if (typeof eventCallbacks.onConnect === "function") {
              eventCallbacks.onConnect(code, true);
            }
            resolve(code);
          });

          peer.on("connection", (conn) => {
            setupConnection(conn);
          });

          peer.on("error", (err) => {
            console.error("Peer host error:", err);
            if (err.type === "unavailable-id") {
              // ID already taken, retry with a fresh code
              notifyStatus("Code already in use, generating a fresh room code...", "warning");
              hostRoom().then(resolve).catch(reject);
            } else {
              notifyStatus(`Host error: ${err.message || err}`, "error");
              reject(err);
            }
          });

          peer.on("disconnected", () => {
            notifyStatus("Disconnected from signaling server.", "warning");
          });
        } catch (err) {
          reject(err);
        }
      });
    }

    // Join Room
    function joinRoom(inputCode) {
      disconnect();
      const code = cleanRoomCode(inputCode);
      if (!code) {
        notifyStatus("Please enter a valid room code (e.g. GT-8A92)", "error");
        return Promise.reject(new Error("Invalid room code"));
      }

      roomCode = code;
      isHost = false;
      const targetHostPeerId = `${PEER_PREFIX}${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

      notifyStatus(`Connecting to Room ${code}...`, "info");

      const PeerClass = (typeof window !== "undefined" && window.Peer) ? window.Peer : null;
      if (!PeerClass) {
        notifyStatus("PeerJS library not loaded. Please refresh.", "error");
        return Promise.reject(new Error("PeerJS not loaded"));
      }

      return new Promise((resolve, reject) => {
        try {
          peer = new PeerClass({
            config: { iceServers: STUN_SERVERS }
          });

          peer.on("open", (id) => {
            localPeerId = id;
            const conn = peer.connect(targetHostPeerId, { reliable: true });
            setupConnection(conn);

            conn.on("open", () => {
              isConnected = true;
              notifyStatus(`Joined Room ${code} successfully!`, "success");
              startTickLoop();
              if (typeof eventCallbacks.onConnect === "function") {
                eventCallbacks.onConnect(code, false);
              }
              resolve(code);
            });

            conn.on("error", (err) => {
              notifyStatus(`Failed to connect to host: ${err.message || err}`, "error");
              reject(err);
            });
          });

          peer.on("error", (err) => {
            console.error("Peer join error:", err);
            notifyStatus(`Join error: ${err.message || err}`, "error");
            reject(err);
          });
        } catch (err) {
          reject(err);
        }
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
      remotePlayers.clear();
      if (peer) {
        try { peer.destroy(); } catch (e) {}
        peer = null;
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
        // Smooth lerp on position (exponential decay towards target)
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
    createMultiplayerClient
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.GTWorldMultiplayer;
  }
})(typeof window !== "undefined" ? window : globalThis);
