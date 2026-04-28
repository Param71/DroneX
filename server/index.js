const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Use Railway's dynamic port, or fallback to 3000/8080 for local development
const PORT = process.env.PORT || 3000; 

app.set('trust proxy', 1);

app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net cdnjs.cloudflare.com fonts.googleapis.com unpkg.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com; font-src fonts.gstatic.com; connect-src 'self' ws: wss:; img-src 'self' data:;");
    next();
});

app.get('/', (req, res) => {
    res.redirect('/garage.html');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.use(express.static(path.join(__dirname, '../public')));

// LEADERBOARD
let leaderboard = [];

const rateLimits = {};
app.post('/api/leaderboard', (req, res) => {
    const ip = req.ip;
    const now = Date.now();
    if (!rateLimits[ip]) rateLimits[ip] = { count: 0, resetTime: now + 60000 };
    if (now > rateLimits[ip].resetTime) {
        rateLimits[ip].count = 0;
        rateLimits[ip].resetTime = now + 60000;
    }
    if (rateLimits[ip].count >= 5) {
        return res.status(429).json({ error: 'Too many requests' });
    }
    rateLimits[ip].count++;

    let { pilotName, time, droneType } = req.body;
    if (typeof pilotName !== 'string' || typeof time !== 'number' || typeof droneType !== 'string') {
        return res.status(400).json({ error: 'Invalid data types' });
    }

    pilotName = pilotName.replace(/[<>&"']/g, '').substring(0, 20).trim();
    if (!pilotName) pilotName = 'Anonymous';

    if (time < 1 || time > 90) {
        return res.status(400).json({ error: 'Invalid time' });
    }

    if (!['racing', 'delivery', 'surveillance'].includes(droneType)) {
        return res.status(400).json({ error: 'Invalid drone type' });
    }

    leaderboard.push({ pilotName, time, droneType, timestamp: Date.now() });
    leaderboard.sort((a, b) => a.time - b.time);
    if (leaderboard.length > 100) leaderboard.pop();

    res.json(leaderboard.slice(0, 10));
});

app.get('/api/leaderboard', (req, res) => {
    res.json(leaderboard.slice(0, 10));
});

// SESSION PAIRING
const sessions = {}; // { code: { laptopSocketId, phoneSocketId, createdAt } }

setInterval(() => {
    const now = Date.now();
    for (const code in sessions) {
        if (now - sessions[code].createdAt > 10 * 60 * 1000) {
            delete sessions[code];
        }
    }
}, 5 * 60 * 1000);

io.on('connection', (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // Laptop requests a session code
    socket.on('session:init', () => {
        let code;
        do {
            code = Math.floor(1000 + Math.random() * 9000).toString();
        } while (sessions[code]);

        sessions[code] = { laptopSocketId: socket.id, phoneSocketId: null, createdAt: Date.now() };
        socket.emit('session:code', code);
    });

    // Laptop restores session across page loads
    socket.on('session:restore', (code) => {
        if (sessions[code]) {
            sessions[code].laptopSocketId = socket.id;
            sessions[code].createdAt = Date.now(); // reset expiry
            if (sessions[code].phoneSocketId) {
                socket.emit('session:phoneConnected');
            }
        }
    });

    // Phone joins
    socket.on('session:join', (data) => {
        const { code } = data;
        if (!code || !sessions[code]) {
            return socket.emit('session:error', 'Invalid code');
        }
        if (sessions[code].phoneSocketId && sessions[code].phoneSocketId !== socket.id) {
            return socket.emit('session:error', 'Code already in use');
        }
        sessions[code].phoneSocketId = socket.id;
        socket.emit('session:joined');
        io.to(sessions[code].laptopSocketId).emit('session:phoneConnected');
    });

    // Helper to find session by phone or laptop
    function getSessionBySocketId(id) {
        for (const code in sessions) {
            if (sessions[code].laptopSocketId === id || sessions[code].phoneSocketId === id) {
                return sessions[code];
            }
        }
        return null;
    }

    socket.on('drone:control', (data) => {
        const session = getSessionBySocketId(socket.id);
        if (session && session.laptopSocketId) {
            io.to(session.laptopSocketId).emit('drone:control', data);
        }
    });

    socket.on('drone:status', (data) => {
        const session = getSessionBySocketId(socket.id);
        if (session && session.phoneSocketId) {
            io.to(session.phoneSocketId).emit('drone:status', data);
        }
    });

    socket.on('drone:event', (data) => {
        const session = getSessionBySocketId(socket.id);
        if (session && session.phoneSocketId) {
            io.to(session.phoneSocketId).emit('drone:event', data);
        }
    });

    socket.on('drone:toggleFPV', () => {
        const session = getSessionBySocketId(socket.id);
        if (session && session.laptopSocketId) {
            io.to(session.laptopSocketId).emit('drone:toggleFPV');
        }
    });

    socket.on('drone:menu', (data) => {
        const session = getSessionBySocketId(socket.id);
        if (session && session.laptopSocketId) {
            io.to(session.laptopSocketId).emit('drone:menu', data);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Disconnected: ${socket.id}`);
        const session = getSessionBySocketId(socket.id);
        if (session) {
            if (session.phoneSocketId === socket.id) {
                session.phoneSocketId = null;
            }
            // we don't null laptopSocketId on disconnect immediately to allow page reloads
        }
    });
});

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}

// Bind to 0.0.0.0 to accept external connections
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 DroneX Server is running!`);
    console.log(`Listening on port: ${PORT}`);
});
