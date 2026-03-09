const { verifyToken } = require('@clerk/express');

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
        });

        const clerkUserId = payload.sub;
        if (!clerkUserId) {
            return res.status(401).json({ error: 'Invalid token: no user ID' });
        }

        const db = req.app.locals.db;

        let user = (await db.query(
            'SELECT * FROM users WHERE clerk_id = $1 AND is_active = true',
            [clerkUserId]
        )).rows[0];

        if (!user) {
            const { v4: uuidv4 } = require('uuid');
            const id = uuidv4();
            const email = payload.email || `clerk-${clerkUserId}@managed`;
            const name = payload.name || 'New User';

            await db.query(
                `INSERT INTO users (id, site_id, name, email, password_hash, role, clerk_id)
                 VALUES ($1, 'site-001', $2, $3, 'clerk-managed', 'CRC', $4)`,
                [id, name, email, clerkUserId]
            );

            user = (await db.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
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

async function auditLog(db, { siteId, userId, entityType, entityId, action, diff = {} }) {
    const { v4: uuidv4 } = require('uuid');
    await db.query(
        `INSERT INTO audit_logs (id, site_id, user_id, entity_type, entity_id, action, diff)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), siteId, userId, entityType, entityId, action, JSON.stringify(diff)]
    );
}

module.exports = { authMiddleware, requireRole, auditLog };
