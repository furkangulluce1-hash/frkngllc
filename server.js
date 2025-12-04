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
    rooms.set(roomId, {
        id: roomId,
        videoUrl: '',
        isPlaying: false,
        currentTime: 0,
        users: [],
        messages: [],
        createdAt: new Date()
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
        // Oda yoksa oluştur
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                id: roomId,
                videoUrl: '',
                isPlaying: false,
                currentTime: 0,
                users: [],
                messages: [],
                createdAt: new Date()
            });
        }

        const room = rooms.get(roomId);
        
        // Kullanıcı limiti (7 kişi)
        if (room.users.length >= 7) {
            socket.emit('room-full');
            return;
        }

        // İlk katılan ev sahibi olur
        const isHost = room.users.length === 0;
        
        const user = {
            visitorId: socket.id,
            username: username || `Misafir${Math.floor(Math.random() * 1000)}`,
            joinedAt: new Date(),
            isHost: isHost
        };

        room.users.push(user);
        socket.join(roomId);
        socket.roomId = roomId;
        socket.username = user.username;
        socket.isHost = isHost;

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

        console.log(`${user.username} odaya katıldı: ${roomId}`);
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

    // Video oynat/duraklat
    socket.on('play-pause', ({ roomId, isPlaying, currentTime }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.isPlaying = isPlaying;
            room.currentTime = currentTime;
            socket.to(roomId).emit('sync-video', { isPlaying, currentTime });
        }
    });

    // Video zaman senkronizasyonu
    socket.on('seek', ({ roomId, currentTime }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.currentTime = currentTime;
            socket.to(roomId).emit('sync-video', { 
                isPlaying: room.isPlaying, 
                currentTime 
            });
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

    // Bağlantı koptu
    socket.on('disconnect', () => {
        if (socket.roomId) {
            const room = rooms.get(socket.roomId);
            if (room) {
                room.users = room.users.filter(u => u.visitorId !== socket.id);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎬 Maç İzle sunucusu çalışıyor: http://localhost:${PORT}`);
});

