import { Request, Response, NextFunction } from 'express';
import { getAuthToken } from '../helpers/getAuthToken';
import { verifyAuthToken } from '../helpers/verifyAuthToken';
import { UserService } from '../services/UserService';

function ensureAuthenticated(
    request: Request,
    response: Response,
    next: NextFunction
) {
    const authToken = getAuthToken(request.headers.authorization);

    if (!authToken) {
        return response.status(401).json({
            message: 'No token provided.',
        });
    }

    try {
        const authenticatedUser = verifyAuthToken(authToken);
        request.headers.authenticatedUserId = authenticatedUser.id;

        return next();
    } catch (err) {
        return response.status(401).json({
            message: 'Token expired.',
        });
    }
}

async function ensureAdminAuthenticated(
    request: Request,
    response: Response,
    next: NextFunction
) {
    try {
        const userId = request.headers.authenticatedUserId as string;

        if (!userId) {
            return response.status(401).json({
                message: 'No userId provided.',
            });
        }

        const userService = new UserService();
        const user = await userService.getUserByID(userId);

        if (!user) {
            return response.status(401).json({
                message: 'User not found.',
            });
        }

        if (!user.role || user.role !== 'admin') {
            return response.status(401).json({
                message: 'User is not an admin.',
            });
        }

        return next();
    } catch (err) {
        return response.status(500).json({
            message: 'Internal Server Error',
        });
    }
}

export { ensureAuthenticated, ensureAdminAuthenticated };
