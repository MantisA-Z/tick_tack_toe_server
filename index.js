require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: true,
});

const roomTable = new Map();
const userTable = new Map();

function checkWin(moves, socket, roomName) {
  const socketId = socket.id;
  const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const [a, b, c] of winningCombinations) {
    if (moves[a] && moves[a] === moves[b] && moves[a] === moves[c]) {
      return io.to(roomName).emit("server:user-win", { socketId });
    }
  }

  if (moves.every((val) => val !== "")) {
    io.to(roomName).emit("server:game-draw", {});
  } else {
    //the broadcaster's moves to the whole room
    io.to(roomName).emit("server:moves", { moves });
  }

  //broadcast to other user that it is his turn
  socket.broadcast.emit("server:turn", { socketId });
}

io.on("connection", (socket) => {
  console.log(`New socket connection: ${socket.id}`);
  socket.on("user:join-room", ({ roomName }) => {
    const roomMembers = roomTable.get(roomName) || [];
    //check if room is full or not and send msg
    if (roomMembers.length >= 2)
      return socket.emit("server:room-full", { msg: "Room occupied" });

    //User joins the room and send join msg to the room with members Id
    socket.join(roomName);
    userTable.set(socket.id, roomName);
    roomTable.set(roomName, [...roomMembers, socket.id]);
    const updatedRoomMembers = [...roomMembers, socket.id];
    io.to(roomName).emit("server:room-joined", {
      roomName,
      updatedRoomMembers,
    });

    if (roomTable.get(roomName)?.length === 2) {
      const members = roomTable.get(roomName);
      const X = members[Math.floor(Math.random() * 2)];
      const O = members.filter((val, i) => val !== X);
      io.to(X).emit("server:X-turn");
      io.to(O).emit("server:O-turn");
    }
  });

  socket.on("user:move", ({ moves, roomName }) => {
    checkWin(moves, socket, roomName);
    console.log(moves);
  });

  socket.on("disconnect", () => {
    const userRoomName = userTable.get(socket.id);
    if (userRoomName) {
      const remainingUsers = roomTable
        .get(userRoomName)
        .filter((val, index) => val !== socket.id);

      roomTable.set(userRoomName, remainingUsers);
      io.to(userRoomName).emit("server:user-room-left", { remainingUsers });
      userTable.delete(socket.id);
      console.log(roomTable);
    }
  });
});

app.get("/", (req, res) => {
  res.send("yo Mr White");
});

const PORT = process.env.PORT;

server.listen(PORT, () => {
  console.log(`server started on port: ${PORT}`);
});
