require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const { Pool } = require('pg');
const { Parser } = require('json2csv');

const app = express();
const server = http.createServer(app);

const allowedOrigins = ["http://localhost:3000", "http://localhost:5173"];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
    },
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/monitor', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// PostgreSQL connection pool
const pgPool = new Pool({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DB || 'monitor',
    password: process.env.PG_PASSWORD || 'password',
    port: process.env.PG_PORT || 5432,
});

// MongoDB schemas/models
const Log = mongoose.model('Log', new mongoose.Schema({
    message: String,
    timestamp: Date,
}));

const Metric = mongoose.model('Metric', new mongoose.Schema({
    cpu: Number,
    mem: Number,
    timestamp: Date,
}));

// API endpoints
app.get('/api/metrics', async (req, res) => {
    try {
        const latest = await Metric.find().sort({ timestamp: -1 }).limit(1);
        res.json(latest[0] || { cpu: 0, mem: 0, timestamp: new Date() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/logs', async (req, res) => {
    try {
        const logs = await Log.find().sort({ timestamp: -1 }).limit(50);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/ml/anomaly', (req, res) => {
    res.json({
        anomaly: false,
        score: 0,
    });
});

app.get('/api/ml/optimizer', (req, res) => {
    res.json({
        suggestion: "Reduce CPU-intensive batch jobs",
        impact: 0.15,
    });
});

app.get('/api/db/stats', async (req, res) => {
    try {
        const result = await pgPool.query(`SELECT * FROM db_stats ORDER BY timestamp DESC LIMIT 10`);
        res.json(result.rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export all metrics as JSON
app.get('/api/export/metrics', async (req, res) => {
    try {
        const metrics = await Metric.find().sort({ timestamp: 1 });
        res.setHeader('Content-Disposition', 'attachment; filename=metrics.json');
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(metrics, null, 2));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export all logs as JSON
app.get('/api/export/logs', async (req, res) => {
    try {
        const logs = await Log.find().sort({ timestamp: 1 });
        res.setHeader('Content-Disposition', 'attachment; filename=logs.json');
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(logs, null, 2));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export metrics as CSV
app.get('/api/export/metrics.csv', async (req, res) => {
    try {
        const metrics = await Metric.find().sort({ timestamp: 1 });
        const fields = ['cpu', 'mem', 'timestamp'];
        const parser = new Parser({ fields });
        const csv = parser.parse(metrics);
        res.setHeader('Content-Disposition', 'attachment; filename=metrics.csv');
        res.setHeader('Content-Type', 'text/csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Initialize PostgreSQL table if not exists
async function initDb() {
    try {
        await pgPool.query(`
        CREATE TABLE IF NOT EXISTS db_stats (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP NOT NULL,
            connections INTEGER NOT NULL,
            query_count INTEGER NOT NULL,
            cache_hit_ratio FLOAT NOT NULL
        )
        `);
        console.log('✅ PostgreSQL table initialized');
    } catch (err) {
        console.error('❌ PostgreSQL error:', err);
    }
}

initDb();

// Emit simulated metrics every 5 seconds
setInterval(async () => {
    const cpu = +(Math.random() * 100).toFixed(2); // CPU %
    const mem = +(Math.random() * 12 + 4).toFixed(2); // Memory: 4 - 16 GB
    const timestamp = new Date();

    const metric = await Metric.create({ cpu, mem, timestamp });
    const log = await Log.create({
    message: `CPU: ${cpu}%, Mem: ${mem}GB`,
    timestamp,
    });

    io.emit('metrics', metric);
    io.emit('log', log);

    if (cpu > 90) {
        io.emit('alert', {
        type: 'High CPU',
        value: cpu,
        time: timestamp,
        });
    }

  // Random DB stats
    await pgPool.query(`
        INSERT INTO db_stats (timestamp, connections, query_count, cache_hit_ratio)
        VALUES (NOW(), $1, $2, $3)
    `, [
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 1000),
        Math.random(),
    ]);

    const { rows } = await pgPool.query(`
        SELECT * FROM db_stats ORDER BY timestamp DESC LIMIT 10
    `);
    io.emit('db_stats', rows);

  // Dummy anomaly detection
    const anomalyDetected = Math.random() > 0.8;
    const anomalyScore = +(Math.random()).toFixed(2);
    io.emit('anomaly', {
        anomaly: anomalyDetected,
        score: anomalyScore,
    });

  // Dummy optimization suggestions
    const suggestions = [
        { suggestion: "Reduce CPU-intensive batch jobs", impact: 0.15 },
        { suggestion: "Optimize database queries", impact: 0.1 },
        { suggestion: "Increase memory cache size", impact: 0.2 },
        { suggestion: "Schedule heavy tasks during off-peak hours", impact: 0.12 },
    ];
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    io.emit('optimization', randomSuggestion);
}, 5000); // every 5 seconds

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
