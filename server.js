const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static("public"));

const rooms = {};
const MAX_USERS = 6;

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = [];
    if (rooms[roomId].length >= MAX_USERS) {
      socket.emit("room-full");
      return;
    }

    socket.data.name = userName;

    rooms[roomId].push({ id: socket.id, name: userName });

    const otherUsers = rooms[roomId].filter((u) => u.id !== socket.id);
    socket.emit("all-users", otherUsers);

    socket.on("offer", ({ offer, to }) => {
      io.to(to).emit("offer", { from: socket.id, offer, name: socket.data.name });
    });

    socket.on("answer", ({ answer, to }) => {
      io.to(to).emit("answer", { from: socket.id, answer });
    });

    socket.on("ice-candidate", ({ candidate, to }) => {
      io.to(to).emit("ice-candidate", { from: socket.id, candidate });
    });

    socket.on("disconnect", () => {
      rooms[roomId] = rooms[roomId].filter((user) => user.id !== socket.id);

      socket.to(roomId).emit("user-disconnected", socket.id);
      if (rooms[roomId].length === 0) delete rooms[roomId];
    });
  });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
