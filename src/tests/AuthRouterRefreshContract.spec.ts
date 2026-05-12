import supertest from 'supertest';

import { app } from '../app';

const loginMock = jest.fn();
const refreshSessionMock = jest.fn();

jest.mock('../services/AuthService', () => ({
    AuthService: jest.fn().mockImplementation(() => ({
        login: loginMock,
        refreshSession: refreshSessionMock,
        getCurrentUser: jest.fn(),
        resetPassword: jest.fn(),
    })),
}));

describe('Auth router refresh contract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return auth session on login', async () => {
        loginMock.mockResolvedValueOnce({
            token: 'access-token',
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
            refreshExpiresIn: 86400,
        });

        const response = await supertest(app)
            .post('/api/auth/login')
            .send({ email: 'professor@ufba.br', password: 'senha123' });

        expect(response.status).toBe(201);
        expect(response.body.auth).toBe(true);
        expect(response.body.accessToken).toBe('access-token');
        expect(response.body.refreshToken).toBe('refresh-token');
    });

    it('should refresh session when refresh token is provided', async () => {
        refreshSessionMock.mockResolvedValueOnce({
            token: 'new-access-token',
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
            refreshExpiresIn: 86400,
        });

        const response = await supertest(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'refresh-token' });

        expect(response.status).toBe(200);
        expect(response.body.auth).toBe(true);
        expect(response.body.accessToken).toBe('new-access-token');
        expect(response.body.refreshToken).toBe('new-refresh-token');
        expect(refreshSessionMock).toHaveBeenCalledWith('refresh-token');
    });

    it('should validate refresh token payload', async () => {
        const response = await supertest(app)
            .post('/api/auth/refresh')
            .send({});

        expect(response.status).toBe(400);
    });
});