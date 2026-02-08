import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  push,
  set,
  update,
  remove,
  runTransaction,
  onDisconnect,
  get,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN",
  databaseURL: "PASTE_YOUR_DATABASE_URL",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const state = {
  user: null,
  roomId: null,
  roomUnsub: null,
};

const loginSection = document.getElementById("login");
const lobbySection = document.getElementById("lobby");
const roomSection = document.getElementById("room");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const userPill = document.getElementById("userPill");
const roomsList = document.getElementById("roomsList");
const createRoomButton = document.getElementById("createRoom");
const refreshRoomsButton = document.getElementById("refreshRooms");
const roomTitle = document.getElementById("roomTitle");
const roomStatus = document.getElementById("roomStatus");
const leaveRoomButton = document.getElementById("leaveRoom");
const playersContainer = document.getElementById("players");
const boardContainer = document.getElementById("board");
const turnInfo = document.getElementById("turnInfo");
const gameResult = document.getElementById("gameResult");

const roomsRef = ref(db, "rooms");

const uidKey = "ix_adler_uid";
const storedUid = localStorage.getItem(uidKey);
const uid = storedUid || crypto.randomUUID();
localStorage.setItem(uidKey, uid);

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = usernameInput.value.trim();
  if (!name) return;
  state.user = { id: uid, name };
  userPill.textContent = `שלום, ${name}`;
  showSection(lobbySection);
  loadRooms();
});

createRoomButton.addEventListener("click", async () => {
  if (!state.user) return;
  const newRoomRef = push(roomsRef);
  const roomId = newRoomRef.key;
  const roomData = {
    name: `חדר של ${state.user.name}`,
    status: "waiting",
    createdAt: Date.now(),
    hostId: state.user.id,
    board: Array(9).fill(""),
    turn: "X",
    winner: "",
    players: {
      [state.user.id]: {
        name: state.user.name,
        symbol: "X",
        joinedAt: Date.now(),
      },
    },
  };

  await set(newRoomRef, roomData);
  await joinRoom(roomId);
});

refreshRoomsButton.addEventListener("click", () => {
  loadRooms();
});

leaveRoomButton.addEventListener("click", () => {
  leaveRoom();
});

function showSection(section) {
  [loginSection, lobbySection, roomSection].forEach((el) => {
    el.classList.toggle("hidden", el !== section);
  });
}

function loadRooms() {
  onValue(roomsRef, (snapshot) => {
    const rooms = snapshot.val() || {};
    renderRooms(rooms);
  });
}

function renderRooms(rooms) {
  roomsList.innerHTML = "";
  const entries = Object.entries(rooms).sort((a, b) => b[1].createdAt - a[1].createdAt);

  if (!entries.length) {
    roomsList.innerHTML = `<div class="room-card">אין חדרים כרגע. פתח חדר חדש 🎉</div>`;
    return;
  }

  entries.forEach(([roomId, room]) => {
    const playersCount = room.players ? Object.keys(room.players).length : 0;
    const canJoin = playersCount < 2 && room.status !== "finished";

    const card = document.createElement("div");
    card.className = "room-card";
    card.innerHTML = `
      <div class="room-card__info">
        <strong>${room.name}</strong>
        <span>שחקנים: ${playersCount}/2</span>
      </div>
      <div>
        <span class="badge">${room.status === "waiting" ? "ממתין" : room.status === "playing" ? "משחק" : "הסתיים"}</span>
      </div>
    `;

    const joinButton = document.createElement("button");
    joinButton.className = "btn primary";
    joinButton.textContent = canJoin ? "הצטרפות" : "צפייה";
    joinButton.disabled = !canJoin;
    joinButton.addEventListener("click", () => joinRoom(roomId));

    card.appendChild(joinButton);
    roomsList.appendChild(card);
  });
}

async function joinRoom(roomId) {
  if (!state.user) return;
  state.roomId = roomId;

  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return;

  const room = snapshot.val();
  const players = room.players || {};
  if (!players[state.user.id]) {
    const symbol = Object.values(players).some((p) => p.symbol === "X") ? "O" : "X";
    const playerRef = ref(db, `rooms/${roomId}/players/${state.user.id}`);
    await set(playerRef, {
      name: state.user.name,
      symbol,
      joinedAt: Date.now(),
    });
  }

  await onDisconnect(ref(db, `rooms/${roomId}/players/${state.user.id}`)).remove();

  showSection(roomSection);
  subscribeRoom(roomId);
}

function subscribeRoom(roomId) {
  if (state.roomUnsub) state.roomUnsub();
  const roomRef = ref(db, `rooms/${roomId}`);
  state.roomUnsub = onValue(roomRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      showSection(lobbySection);
      return;
    }

    const players = room.players || {};
    const playersCount = Object.keys(players).length;

    if (playersCount === 2 && room.status === "waiting") {
      update(roomRef, {
        status: "playing",
        board: Array(9).fill(""),
        turn: "X",
        winner: "",
      });
    }

    if (playersCount < 2 && room.status === "playing") {
      update(roomRef, {
        status: "waiting",
        board: Array(9).fill(""),
        turn: "X",
        winner: "",
      });
    }

    renderRoom(room);
  });
}

function renderRoom(room) {
  roomTitle.textContent = room.name;
  roomStatus.textContent =
    room.status === "waiting" ? "ממתין לשחקן נוסף" : room.status === "playing" ? "במשחק" : "הסתיים";

  renderPlayers(room.players || {});
  renderBoard(room.board || Array(9).fill(""), room);

  const winnerText = room.winner
    ? `מנצח: ${room.winner}`
    : room.status === "finished"
      ? "תיקו!"
      : "";
  gameResult.textContent = winnerText;
}

function renderPlayers(players) {
  playersContainer.innerHTML = "";
  Object.entries(players).forEach(([id, player]) => {
    const card = document.createElement("div");
    card.className = "player-card";
    card.innerHTML = `
      <strong>${player.name}</strong>
      <span>סמל: ${player.symbol}</span>
      <span>${id === state.user?.id ? "זה אתה" : "יריב"}</span>
    `;
    playersContainer.appendChild(card);
  });
}

function renderBoard(board, room) {
  boardContainer.innerHTML = "";
  const players = room.players || {};
  const me = players[state.user?.id];
  const isMyTurn = room.turn === me?.symbol && room.status === "playing";

  turnInfo.textContent =
    room.status === "playing"
      ? isMyTurn
        ? "התור שלך!"
        : "התור של היריב"
      : room.status === "waiting"
        ? "ממתין לשחקן נוסף..."
        : "המשחק הסתיים";

  board.forEach((cell, index) => {
    const cellButton = document.createElement("button");
    cellButton.className = "cell";
    cellButton.textContent = cell || "";
    if (!isMyTurn || cell || room.status !== "playing") {
      cellButton.classList.add("disabled");
      cellButton.disabled = true;
    }
    cellButton.addEventListener("click", () => makeMove(index));
    boardContainer.appendChild(cellButton);
  });
}

async function makeMove(index) {
  if (!state.roomId) return;
  const roomRef = ref(db, `rooms/${state.roomId}`);

  await runTransaction(roomRef, (room) => {
    if (!room || room.status !== "playing") return room;
    const players = room.players || {};
    const me = players[state.user?.id];
    if (!me || room.turn !== me.symbol) return room;
    if (room.board[index]) return room;

    const newBoard = [...room.board];
    newBoard[index] = me.symbol;

    const winnerSymbol = getWinner(newBoard);
    const isDraw = !winnerSymbol && newBoard.every((cell) => cell);

    return {
      ...room,
      board: newBoard,
      turn: room.turn === "X" ? "O" : "X",
      status: winnerSymbol || isDraw ? "finished" : "playing",
      winner: winnerSymbol ? playersBySymbol(players, winnerSymbol) : "",
    };
  });
}

function playersBySymbol(players, symbol) {
  const entry = Object.values(players).find((player) => player.symbol === symbol);
  return entry ? entry.name : "";
}

function getWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return "";
}

async function leaveRoom() {
  if (!state.roomId || !state.user) {
    showSection(lobbySection);
    return;
  }

  const roomId = state.roomId;
  const playerRef = ref(db, `rooms/${roomId}/players/${state.user.id}`);
  await remove(playerRef);

  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (snapshot.exists()) {
    const room = snapshot.val();
    const players = room.players || {};
    const playersCount = Object.keys(players).length;
    if (playersCount === 0) {
      await remove(roomRef);
    } else if (playersCount === 1) {
      await update(roomRef, {
        status: "waiting",
        board: Array(9).fill(""),
        turn: "X",
        winner: "",
        hostId: Object.keys(players)[0],
      });
    }
  }

  state.roomId = null;
  showSection(lobbySection);
}
