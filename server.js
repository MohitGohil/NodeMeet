const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { randomUUID } = require("crypto");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
  socket.on("join", (roomId) => {
    socket.join(roomId);
    const room = io.sockets.adapter.rooms.get(roomId);
    const numClients = room ? room.size : 0;

    if (numClients > 1) {
      socket.to(roomId).emit("user-connected");
    }

    socket.on("offer", (data) => socket.to(roomId).emit("offer", data));
    socket.on("answer", (data) => socket.to(roomId).emit("answer", data));
    socket.on("ice-candidate", (data) => socket.to(roomId).emit("ice-candidate", data));
    socket.on("disconnect", () => socket.to(roomId).emit("user-disconnected"));
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
