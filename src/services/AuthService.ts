import * as crypto from 'crypto';
import { sign } from 'jsonwebtoken';
import { Repository, getCustomRepository } from 'typeorm';

import { User } from '../entities/User';
import { UserRepository } from '../repositories/UserRepository';
import { AppError } from './../errors/AppError';
import Mailer from '../middlewares/Mailer';
import { assertUfbaInstitutionalEmail, normalizeEmail } from '../helpers/institutionalEmail';

class AuthService {
    private userRepository : Repository<User>;

    constructor() {
        this.userRepository = getCustomRepository(UserRepository);
    }

    async login(email: string, password: string) {
        const normalizedEmail = typeof email === 'string' ? normalizeEmail(email) : '';

        if (!normalizedEmail || password == undefined) {
            throw new AppError('Username or password missing. Please try again!', 400);
        }

        if (!assertUfbaInstitutionalEmail(normalizedEmail)) {
            throw new AppError('Only UFBA institutional email addresses are allowed.', 400);
        }

        const user = await this.userRepository.findOne({
            where: {
                email: normalizedEmail,
                password: crypto.createHmac('sha256', password).digest('hex')
            },
        });

        if (!user) {
            throw new AppError('Incorrect username and/or password. Please try again!', 400);
        }

        const { id, name } = user;

        return sign({ id, name, email }, String(process.env.JWT_SECRET), { expiresIn: Number(process.env.JWT_DEADLINE) });
    }

    async getCurrentUser(userId: string) {
        const user = await this.userRepository.findOne({ id: userId });

        if (!user) {
            throw new AppError('User does not exists!', 400);
        }

        return user;
    }


    async resetPassword(email: string) {
        const normalizedEmail = typeof email === 'string' ? normalizeEmail(email) : '';

        if (!assertUfbaInstitutionalEmail(normalizedEmail)) {
            throw new AppError('Only UFBA institutional email addresses are allowed.', 400);
        }

        const user = await this.userRepository.findOne({ email: normalizedEmail });

        if (!user) {
            throw new AppError('User does not exists!', 400);
        }

        try {
            const generatedHash = Math.random().toString(36).substring(2);
            const generatedPassword = crypto.createHmac('sha256', generatedHash).digest('hex');

            await this.userRepository.createQueryBuilder().update(User).set({ password: generatedPassword }).where('email = :email', { email: normalizedEmail }).execute();
            await Mailer.execute(normalizedEmail, 'Nova Senha - BDCP', `Prezado(a),\nUse "${generatedHash}" como sua nova senha para acessar o BDCP.`);
        }
        catch (err) {
            console.log(err);
            throw new AppError('An error has been occurred!', 400);
        }
    }

    generateUserInvite() {
        const generatedHash = Math.random().toString(36).substring(2);
        const token = sign({ generatedHash }, String(process.env.JWT_SECRET), { expiresIn: 86400 });

        return token;
    }

}

export { AuthService };
