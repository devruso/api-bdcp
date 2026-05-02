import { Request, Response } from 'express';
import { LoginRequestDto, ResetPasswordRequestDto } from '../dtos/auth';
import { AuthService } from '../services/AuthService';

class AuthController {
    async login(request: Request, response: Response) {
        const { email, password } = request.body as LoginRequestDto;

        const authService = new AuthService();
        const token = await authService.login(email, password);

        return response.status(201).json({ auth: true, token });
    }

    async getCurrentUser(request: Request, response: Response) {
        const userId = request.headers.authenticatedUserId as string;

        if (!userId) {
            return response.status(401).json({ message: 'Unauthorized' });
        }

        const authService = new AuthService();
        const user = await authService.getCurrentUser(userId);

        return response.status(200).json(user);

    }

    async resetPassword(request: Request, response: Response) {
        const { email } = request.body as ResetPasswordRequestDto;

        const authService = new AuthService();
        await authService.resetPassword(email);

        return response.status(201).json({ message: 'A new password has been sent to your email if it is valid. Do not forget to check the spam box!' });
    }

}

export { AuthController };
