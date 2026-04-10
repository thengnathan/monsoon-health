import { verifyToken, createClerkClient } from '@clerk/express';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import type { AuditLogParams } from '../types/index';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

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

            // Fetch real name + email from Clerk before inserting
            let name = 'New User';
            let email = `clerk-${clerkUserId}@managed`;
            try {
                const clerkUser = await clerkClient.users.getUser(clerkUserId);
                const firstName = clerkUser.firstName || '';
                const lastName = clerkUser.lastName || '';
                name = [firstName, lastName].filter(Boolean).join(' ') || 'New User';
                email = clerkUser.emailAddresses?.[0]?.emailAddress || email;
            } catch (e) {
                console.warn('[Auth] Could not fetch Clerk user details:', (e as Error).message);
            }

            const existing = await db.query(
                'SELECT id FROM users WHERE clerk_id = $1',
                [clerkUserId]
            );

            if (existing.rows[0]) {
                await db.query(
                    `UPDATE users SET name = $1, email = $2 WHERE clerk_id = $3 AND is_active = false`,
                    [name, email, clerkUserId]
                );
            } else {
                await db.query(
                    `INSERT INTO users (id, site_id, name, email, password_hash, role, clerk_id, is_active)
                     VALUES ($1, 'site-001', $2, $3, 'clerk-managed', 'CRC', $4, false)`,
                    [id, name, email, clerkUserId]
                );
            }

            res.status(403).json({ error: 'Account pending administrator approval' });
            return;
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
