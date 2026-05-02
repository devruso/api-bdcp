import { sign } from 'jsonwebtoken';
import { AppError } from '../errors/AppError';
import { verifyAuthToken } from '../helpers/verifyAuthToken';

class UserInviteService {
    generateUserInvite() {
        const generatedHash = Math.random().toString(36).substring(2);
        const token = sign({ generatedHash }, String(process.env.JWT_SECRET), { expiresIn: 86400 });

        return token;
    }

    validateUserInvite(token: string) {
        try {
            return verifyAuthToken(token);
        }
        catch (error) {
            throw new AppError('This invite is invalid or already expired.', 401);
        }
    }
}

export { UserInviteService };
