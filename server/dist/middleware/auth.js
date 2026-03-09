"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.requireRole = requireRole;
exports.auditLog = auditLog;
const express_1 = require("@clerk/express");
const uuid_1 = require("uuid");
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = await (0, express_1.verifyToken)(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
        });
        const clerkUserId = payload.sub;
        if (!clerkUserId) {
            res.status(401).json({ error: 'Invalid token: no user ID' });
            return;
        }
        const db = req.app.locals.db;
        let user = (await db.query('SELECT * FROM users WHERE clerk_id = $1 AND is_active = true', [clerkUserId])).rows[0];
        if (!user) {
            const id = (0, uuid_1.v4)();
            const email = payload.email || `clerk-${clerkUserId}@managed`;
            const name = payload.name || 'New User';
            await db.query(`INSERT INTO users (id, site_id, name, email, password_hash, role, clerk_id)
                 VALUES ($1, 'site-001', $2, $3, 'clerk-managed', 'CRC', $4)`, [id, name, email, clerkUserId]);
            user = (await db.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
        }
        req.user = {
            id: user.id,
            site_id: user.site_id,
            role: user.role,
            email: user.email,
            name: user.name,
            clerk_id: clerkUserId,
            is_active: user.is_active,
            notification_prefs: user.notification_prefs,
            created_at: user.created_at,
            updated_at: user.updated_at,
        };
        next();
    }
    catch (err) {
        const error = err;
        console.error('[Auth] Token verification failed:', error.message);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
async function auditLog(db, { siteId, userId, entityType, entityId, action, diff = {} }) {
    await db.query(`INSERT INTO audit_logs (id, site_id, user_id, entity_type, entity_id, action, diff)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [(0, uuid_1.v4)(), siteId, userId, entityType, entityId, action, JSON.stringify(diff)]);
}
