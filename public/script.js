const socket = io();
const videoGrid = document.getElementById("video-grid");
const peers = {};
let localStream;
let roomId;
let userName;
let isAudioMuted = false;
let isVideoMuted = false;

while (!roomId || !userName) {
  roomId = prompt("Enter Room ID:");
  userName = prompt("Enter Your Name:");
}

const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
  localStream = stream;
  addVideoStream(stream, true, `${userName} (You)`);
  socket.emit("join-room", { roomId, userName });
});

// Handle joining
socket.on("room-full", () => {
  alert("Room is full. Try another.");
  location.reload();
});

socket.on("all-users", (users) => {
  users.forEach(({ id, name }) => {
    const pc = createPeerConnection(id, name);
    peers[id] = pc;
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    pc.createOffer().then((offer) => {
      pc.setLocalDescription(offer);
      socket.emit("offer", { offer, to: id, name: userName });
    });
  });
});

socket.on("offer", ({ from, offer, name }) => {
  const pc = createPeerConnection(from, name);
  peers[from] = pc;
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  pc.setRemoteDescription(new RTCSessionDescription(offer))
    .then(() => pc.createAnswer())
    .then((answer) => {
      pc.setLocalDescription(answer);
      socket.emit("answer", { answer, to: from });
    });
});

socket.on("answer", ({ from, answer }) => {
  const pc = peers[from];
  if (pc) pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice-candidate", ({ from, candidate }) => {
  const pc = peers[from];
  if (pc && candidate) {
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
  }
});

socket.on("user-disconnected", (userId) => {
  const container = document.getElementById(`user-${userId}`);
  if (container) container.remove();
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];
  }
});

function createPeerConnection(peerId, name) {
  const pc = new RTCPeerConnection(config);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { to: peerId, candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    const stream = event.streams[0];
    const container = document.getElementById(`user-${peerId}`);
    if (!container) {
      addVideoStream(stream, false, name, peerId);
    } else {
      stream
        .getTracks()
        .forEach((track) => container.querySelector("video").srcObject.addTrack(track));
    }
  };

  return pc;
}

function addVideoStream(stream, isLocal, name, userId = "local") {
  const container = document.createElement("div");
  container.id = `user-${userId}`;
  container.className = "flex flex-col items-center";

  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = isLocal;
  video.classList.add("video-box");

  const label = document.createElement("div");
  label.className = "text-center mt-2 text-sm text-white";
  label.innerText = name || "Unknown";

  container.appendChild(video);
  container.appendChild(label);
  videoGrid.appendChild(container);

  monitorSpeaking(video, stream);
}
function toggleAudio() {
  isAudioMuted = !isAudioMuted;
  const label = document.getElementById("audioLabel");
  label.textContent = isAudioMuted ? "Unmute" : "Mute";

  // Your logic to mute/unmute stream here
  if (localStream) {
    localStream.getAudioTracks().forEach((track) => (track.enabled = !isAudioMuted));
  }
}

function toggleVideo() {
  isVideoMuted = !isVideoMuted;
  const label = document.getElementById("videoLabel");
  label.textContent = isVideoMuted ? "Video On" : "Video Off";

  // Your logic to enable/disable video stream here
  if (localStream) {
    localStream.getVideoTracks().forEach((track) => (track.enabled = !isVideoMuted));
  }
}

function leaveCall() {
  Object.values(peers).forEach((pc) => pc.close());
  if (localStream) localStream.getTracks().forEach((track) => track.stop());
  socket.disconnect();
  alert("You have left the call.");
  location.reload();
}

function monitorSpeaking(video, stream) {
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  const mic = audioContext.createMediaStreamSource(stream);
  mic.connect(analyser);
  analyser.fftSize = 512;
  const data = new Uint8Array(analyser.frequencyBinCount);

  function check() {
    analyser.getByteFrequencyData(data);
    const volume = data.reduce((a, b) => a + b, 0) / data.length;
    video.classList.toggle("speaking", volume > 25);
    requestAnimationFrame(check);
  }

  check();
}
