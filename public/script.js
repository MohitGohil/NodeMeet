const socket = io();
const roomId =
  prompt("Enter room ID to join or leave blank to auto-generate:") ||
  Math.random().toString(36).substring(2, 10);
alert(`Your Room ID: ${roomId} — open this room in another tab/device to connect.`);

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const joinBtn = document.getElementById("joinBtn");
const muteBtn = document.getElementById("muteBtn");
const videoBtn = document.getElementById("videoBtn");
const leaveBtn = document.getElementById("leaveBtn");

let localStream;
let remoteStream;
let peerConnection;

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Get Media
async function getMedia() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Your browser does not support camera or microphone access.");
    return;
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    alert("Media error: " + err.message);
    console.error("getUserMedia error:", err);
  }
}

joinBtn.onclick = async () => {
  await getMedia();

  peerConnection = new RTCPeerConnection(servers);
  remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;

  // Send local tracks
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // Receive remote tracks
  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  // Send ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { room: roomId, candidate: event.candidate });
    }
  };

  socket.emit("join", roomId);

  // You are the second user (receive offer)
  socket.on("offer", async ({ offer }) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", { room: roomId, answer });
  });

  // You are the first user (send offer)
  socket.on("user-connected", async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", { room: roomId, offer });
  });

  // Receive answer
  socket.on("answer", async ({ answer }) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  });

  // ICE
  socket.on("ice-candidate", async ({ candidate }) => {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error("Error adding received ice candidate", e);
    }
  });

  // Handle disconnection
  socket.on("user-disconnected", () => {
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      remoteVideo.srcObject = null;
    }
  });
};

muteBtn.onclick = () => {
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = !track.enabled;
    muteBtn.textContent = track.enabled ? "Mute" : "Unmute";
  });
};

videoBtn.onclick = () => {
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = !track.enabled;
    videoBtn.textContent = track.enabled ? "Disable Video" : "Enable Video";
  });
};

leaveBtn.onclick = () => {
  peerConnection.close();
  socket.disconnect();
  location.reload();
};

window.addEventListener("load", () => {
  getMedia();
});
