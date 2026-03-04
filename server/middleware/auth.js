const { verifyToken } = require('@clerk/express');
const { getDb } = require('../db/init');

// Clerk auth middleware — verifies Bearer token and maps to internal user
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify the Clerk session token
        const payload = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
        });

        const clerkUserId = payload.sub;
        if (!clerkUserId) {
            return res.status(401).json({ error: 'Invalid token: no user ID' });
        }

        const db = req.app.locals.db;

        // Look up internal user by clerk_id
        let user = db.prepare('SELECT * FROM users WHERE clerk_id = ? AND is_active = 1').get(clerkUserId);

        if (!user) {
            // Auto-provision: create internal user on first Clerk login
            const { v4: uuidv4 } = require('uuid');
            const id = uuidv4();

            // Get name/email from JWT claims if available
            const email = payload.email || `clerk-${clerkUserId}@managed`;
            const name = payload.name || 'New User';

            db.prepare(`
                INSERT INTO users (id, site_id, name, email, password_hash, role, clerk_id)
                VALUES (?, 'site-001', ?, ?, 'clerk-managed', 'CRC', ?)
            `).run(id, name, email, clerkUserId);

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        }

        req.user = {
            id: user.id,
            site_id: user.site_id,
            role: user.role,
            email: user.email,
            name: user.name,
            clerk_id: clerkUserId,
        };

        next();
    } catch (err) {
        console.error('[Auth] Token verification failed:', err.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

function auditLog(db, { siteId, userId, entityType, entityId, action, diff = {} }) {
    const { v4: uuidv4 } = require('uuid');
    db.prepare(`
    INSERT INTO audit_logs (id, site_id, user_id, entity_type, entity_id, action, diff)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), siteId, userId, entityType, entityId, action, JSON.stringify(diff));
}

module.exports = { authMiddleware, requireRole, auditLog };
