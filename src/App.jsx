import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// 🔗 CONNECT DIRECTLY TO YOUR LIVE RENDER BACKEND
const socket = io('https://sync-cnd8.onrender.com');

export default function App() {
  const videoRef = useRef(null);
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [users, setUsers] = useState([]);
  const [needsInteraction, setNeedsInteraction] = useState(true);
  const [initialState, setInitialState] = useState(null);
  const seekTimer = useRef(null);

  useEffect(() => {
    if (!joined) return;
    socket.emit('join_room', { roomId, username });

    socket.on('initial_sync', (state) => {
      setInitialState(state);
      if (videoRef.current) videoRef.current.currentTime = state.timestamp;
    });

    socket.on('sync_play', ({ timestamp }) => {
      if (videoRef.current) {
        videoRef.current.currentTime = timestamp;
        videoRef.current.play().catch(e => console.log("Autoplay blocked", e));
      }
    });

    socket.on('sync_pause', ({ timestamp }) => {
      if (videoRef.current) {
        videoRef.current.currentTime = timestamp;
        videoRef.current.pause();
      }
    });

    socket.on('sync_seek', ({ timestamp }) => {
      if (videoRef.current) videoRef.current.currentTime = timestamp;
    });

    // DRIFT CORRECTION (HEARTBEAT)
    socket.on('heartbeat_sync', ({ timestamp, isPlaying }) => {
      if (videoRef.current && !isHost) {
        const diff = Math.abs(videoRef.current.currentTime - timestamp);
        if (diff > 2) videoRef.current.currentTime = timestamp;
        
        if (isPlaying && videoRef.current.paused) videoRef.current.play().catch(() => {});
        else if (!isPlaying && !videoRef.current.paused) videoRef.current.pause();
      }
    });

    socket.on('users_update', ({ users }) => {
      setUsers(users);
      const me = users.find(u => u.id === socket.id);
      if (me) setIsHost(me.isHost);
    });

    return () => socket.off();
  }, [joined, roomId, username, isHost]);

  // HOST HEARTBEAT
  useEffect(() => {
    if (!isHost || !joined) return;
    const interval = setInterval(() => {
      if (videoRef.current) {
        socket.emit('heartbeat', {
          roomId,
          timestamp: videoRef.current.currentTime,
          isPlaying: !videoRef.current.paused
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isHost, joined, roomId]);

  const handleJoin = () => {
    if (!roomId || !username) return alert("Enter Room ID and Name");
    setJoined(true);
  };

  const handleReady = () => {
    setNeedsInteraction(false);
    if (videoRef.current && initialState?.isPlaying) {
      videoRef.current.play().catch(() => {});
    }
  };

  // DEBOUNCED SEEK
  const handleSeek = () => {
    if (!isHost || !videoRef.current) return;
    clearTimeout(seekTimer.current);
    seekTimer.current = setTimeout(() => {
      socket.emit('seek', { roomId, timestamp: videoRef.current.currentTime });
    }, 300);
  };

  const handlePlay = () => {
    if (!isHost || !videoRef.current) return;
    socket.emit('play', { roomId, timestamp: videoRef.current.currentTime });
  };

  const handlePause = () => {
    if (!isHost || !videoRef.current) return;
    socket.emit('pause', { roomId, timestamp: videoRef.current.currentTime });
  };

  // --- UI STYLES ---
  const containerStyle = { minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem' };
  const videoWrapperStyle = { position: 'relative', width: '100%', maxWidth: '900px', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', aspectRatio: '16/9', marginTop: '1.5rem' };

  if (!joined) {
    return (
      <div style={{...containerStyle, justifyContent: 'center'}}>
        <h1 style={{fontSize: '2.5rem', marginBottom: '2rem'}}>🎬 Watch Party</h1>
        <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px'}}>
          <input placeholder="Your Name" onChange={e => setUsername(e.target.value)} style={{padding: 12, borderRadius: 8, border: 'none', fontSize: 16}}/>
          <input placeholder="Room ID" onChange={e => setRoomId(e.target.value)} style={{padding: 12, borderRadius: 8, border: 'none', fontSize: 16}}/>
          <button onClick={handleJoin} style={{padding: 12, borderRadius: 8, border: 'none', backgroundColor: '#6366f1', color: 'white', fontSize: 16, fontWeight: 'bold', cursor: 'pointer'}}>Join Room</button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h2>Room: {roomId} {isHost && <span style={{color: 'gold', fontSize: '0.8em'}}>(HOST)</span>}</h2>
        <span style={{color: '#94a3b8'}}>{users.length} watching</span>
      </div>
      
      <div style={videoWrapperStyle}>
        <video 
          ref={videoRef}
          src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
          controls={isHost}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={handleSeek}
          style={{ width: '100%', height: '100%' }}
        />
        
        {needsInteraction && (
          <div onClick={handleReady} style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 24, cursor: 'pointer', zIndex: 10, flexDirection: 'column', gap: 10
          }}>
            <div style={{fontSize: 50}}>▶</div>
            <div>Click to Enable Video & Sync</div>
          </div>
        )}
      </div>
      
      {!isHost && <p style={{color: '#94a3b8', marginTop: 10}}>You are a guest. The host controls playback.</p>}
    </div>
  );
}
