const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Statik dosyalar
app.use(express.static(path.join(__dirname, 'public')));

// Odalar veritabanı (bellekte)
const rooms = new Map();

// Peer ID'leri sakla (kullanıcı ID -> peer ID)
const userPeerIds = new Map();

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gizli admin paneli - oda oluşturma
app.get('/admin-gizli-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-gizli-panel.html'));
});

// Oda sayfası
app.get('/room/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

// API: Oda oluştur
app.get('/api/create-room', (req, res) => {
    const roomId = uuidv4().substring(0, 8);
    const hostUsername = req.query.username || 'Ev Sahibi'; // Admin panelinden gelen username
    rooms.set(roomId, {
        id: roomId,
        videoUrl: '',
        isPlaying: false,
        currentTime: 0,
        users: [],
        messages: [],
        createdAt: new Date(),
        hostUsername: hostUsername // Ev sahibi username'i kaydet
    });
    res.json({ roomId });
});

// API: Oda bilgisi
app.get('/api/room/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (room) {
        res.json({ exists: true, userCount: room.users.length });
    } else {
        res.json({ exists: false });
    }
});

// Socket.io bağlantıları
io.on('connection', (socket) => {
    console.log('Kullanıcı bağlandı:', socket.id);

    // Odaya katıl
    socket.on('join-room', ({ roomId, username }) => {
        // Oda yoksa oluştur (normal kullanıcılar için)
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                id: roomId,
                videoUrl: '',
                isPlaying: false,
                currentTime: 0,
                users: [],
                messages: [],
                createdAt: new Date(),
                hostUsername: null // Ev sahibi yok
            });
        }

        const room = rooms.get(roomId);
        
        // Kullanıcı limiti (7 kişi)
        if (room.users.length >= 7) {
            socket.emit('room-full');
            return;
        }

        // Ev sahibi kontrolü
        const finalUsername = username || `Misafir${Math.floor(Math.random() * 1000)}`;
        let isHost = false;
        
        // Eğer hostUsername belirlenmişse, o kullanıcı ev sahibi
        if (room.hostUsername) {
            isHost = room.hostUsername === finalUsername;
        } else {
            // Eğer hostUsername yoksa ve ilk kullanıcıysa, ev sahibi olur
            isHost = room.users.length === 0;
            if (isHost) {
                room.hostUsername = finalUsername; // İlk kullanıcıyı ev sahibi olarak kaydet
            }
        }
        
        const user = {
            visitorId: socket.id,
            username: finalUsername,
            joinedAt: new Date(),
            isHost: isHost
        };

        room.users.push(user);
        socket.join(roomId);
        socket.roomId = roomId;
        socket.username = user.username;
        socket.isHost = isHost;
        socket.userId = user.visitorId;

        // Odadaki herkese bildir
        io.to(roomId).emit('user-joined', {
            user,
            users: room.users,
            videoUrl: room.videoUrl,
            isPlaying: room.isPlaying,
            currentTime: room.currentTime
        });

        // Son mesajları gönder
        socket.emit('chat-history', room.messages.slice(-50));

        // Yeni katılan kullanıcıya ev sahibi bilgisini gönder
        socket.emit('your-host-status', { isHost: user.isHost });

        console.log(`${user.username} odaya katıldı: ${roomId}`);
    });

    // Oda kullanıcıları bilgisi iste
    socket.on('get-room-users', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room) {
            socket.emit('room-users', { users: room.users });
        }
    });

    // Video URL değişti (sadece ev sahibi)
    socket.on('set-video', ({ roomId, videoUrl }) => {
        const room = rooms.get(roomId);
        if (room && socket.isHost) {
            room.videoUrl = videoUrl;
            room.currentTime = 0;
            room.isPlaying = false;
            io.to(roomId).emit('video-changed', { videoUrl });
        }
    });

    // Video oynat/duraklat (sadece ev sahibi)
    socket.on('play-pause', ({ roomId, isPlaying, currentTime }) => {
        const room = rooms.get(roomId);
        if (room && socket.isHost) {
            room.isPlaying = isPlaying;
            room.currentTime = currentTime;
            socket.to(roomId).emit('sync-video', { isPlaying, currentTime });
        }
    });

    // Video zaman senkronizasyonu (sadece ev sahibi)
    socket.on('seek', ({ roomId, currentTime }) => {
        const room = rooms.get(roomId);
        if (room && socket.isHost) {
            room.currentTime = currentTime;
            socket.to(roomId).emit('sync-video', { 
                isPlaying: room.isPlaying, 
                currentTime 
            });
        }
    });

    // Mevcut zamanı al (misafirler için)
    socket.on('get-current-time', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room) {
            socket.emit('current-time', { currentTime: room.currentTime });
        }
    });

    // Chat mesajı
    socket.on('chat-message', ({ roomId, message }) => {
        const room = rooms.get(roomId);
        if (room && message.trim()) {
            const chatMessage = {
                id: uuidv4(),
                username: socket.username,
                message: message.trim(),
                timestamp: new Date()
            };
            room.messages.push(chatMessage);
            
            // Son 100 mesajı tut
            if (room.messages.length > 100) {
                room.messages = room.messages.slice(-100);
            }

            io.to(roomId).emit('new-message', chatMessage);
        }
    });

    // Emoji tepkisi
    socket.on('reaction', ({ roomId, emoji }) => {
        io.to(roomId).emit('show-reaction', {
            username: socket.username,
            emoji
        });
    });

    // Peer ID kaydet
    socket.on('peer-id', ({ roomId, peerId, username }) => {
        if (socket.userId) {
            userPeerIds.set(socket.userId, peerId);
            
            // Odadaki diğer kullanıcılara bildir
            socket.to(roomId).emit('user-peer-id', {
                peerId,
                username
            });
        }
    });

    // Peer ID'leri al
    socket.on('get-peer-ids', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room) {
            const peerIds = room.users
                .filter(u => u.visitorId !== socket.id)
                .map(u => ({
                    peerId: userPeerIds.get(u.visitorId),
                    username: u.username
                }))
                .filter(p => p.peerId && p.peerId !== null && p.peerId !== undefined);
            
            socket.emit('peer-ids', { peerIds });
        }
    });

    // Bağlantı koptu
    socket.on('disconnect', () => {
        if (socket.roomId) {
            const room = rooms.get(socket.roomId);
            if (room) {
                room.users = room.users.filter(u => u.visitorId !== socket.id);
                
                // Peer ID'yi temizle
                if (socket.userId) {
                    userPeerIds.delete(socket.userId);
                }
                
                io.to(socket.roomId).emit('user-left', {
                    username: socket.username,
                    users: room.users
                });

                // Oda boşsa sil
                if (room.users.length === 0) {
                    setTimeout(() => {
                        const currentRoom = rooms.get(socket.roomId);
                        if (currentRoom && currentRoom.users.length === 0) {
                            rooms.delete(socket.roomId);
                            console.log(`Oda silindi: ${socket.roomId}`);
                        }
                    }, 60000); // 1 dakika sonra
                }
            }
        }
        console.log('Kullanıcı ayrıldı:', socket.id);
    });
});

// Uyku modunu önlemek için ping endpoint'i
app.get('/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Her 5 dakikada bir otomatik ping (opsiyonel - cron job ile)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        rooms: rooms.size,
        timestamp: new Date().toISOString() 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎬 Maç İzle sunucusu çalışıyor: http://localhost:${PORT}`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
    console.log(`📡 Ping endpoint: http://localhost:${PORT}/ping`);
});

