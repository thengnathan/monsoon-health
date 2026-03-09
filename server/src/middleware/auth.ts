import { verifyToken } from '@clerk/express';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import type { AuditLogParams } from '../types/index';

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
        });

        const clerkUserId = payload.sub;
        if (!clerkUserId) {
            res.status(401).json({ error: 'Invalid token: no user ID' });
            return;
        }

        const db: Pool = req.app.locals.db;

        let user = (await db.query(
            'SELECT * FROM users WHERE clerk_id = $1 AND is_active = true',
            [clerkUserId]
        )).rows[0];

        if (!user) {
            const id = uuidv4();
            const email = (payload as Record<string, unknown>).email as string || `clerk-${clerkUserId}@managed`;
            const name = (payload as Record<string, unknown>).name as string || 'New User';

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
            is_active: user.is_active,
            notification_prefs: user.notification_prefs,
            created_at: user.created_at,
            updated_at: user.updated_at,
        };

        next();
    } catch (err) {
        const error = err as Error;
        console.error('[Auth] Token verification failed:', error.message);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}

export async function auditLog(db: Pool, { siteId, userId, entityType, entityId, action, diff = {} }: AuditLogParams): Promise<void> {
    await db.query(
        `INSERT INTO audit_logs (id, site_id, user_id, entity_type, entity_id, action, diff)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), siteId, userId, entityType, entityId, action, JSON.stringify(diff)]
    );
}
