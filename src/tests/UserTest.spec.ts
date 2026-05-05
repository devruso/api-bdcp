import { UserController } from '../controllers/UserController';
import { UserInviteService } from '../services/UserInviteService';
import { getCustomRepository } from 'typeorm';
import { UserRepository } from '../repositories/UserRepository';
import connection from './connection';

jest.mock('../middlewares/Mailer', () => ({
    __esModule: true,
    default: {
        execute: jest.fn().mockResolvedValue(undefined),
    },
}));
/* eslint-disable */
const MockExpressRequest = require('mock-express-request');
const MockExpressResponse = require('mock-express-response');
/* eslint-enable */

beforeAll(async ()=>{
    await connection.create();
});

afterAll(async ()=>{
    await connection.close();
});

beforeEach(async () => {
    await connection.clear();
});

const getInviteToken = () => new UserInviteService().generateUserInvite();

describe('Create new user', ()=>{
    it('should be able to create new user', async ()=>{
        const inviteToken = getInviteToken();
        const req = new MockExpressRequest({
            method:'POST',
            headers: {
                'Content-Type':'application/json',
            },
            params: {
                inviteToken,
            },
            body:{
                'name': 'Test',
                'email': 'test@gmail.com',
                'password':'test123'
            }
        });
        const res = new MockExpressResponse();
        const userController = new UserController();
        await userController.create(req, res);
        expect(res.statusCode).toBe(201);
        
    });
    it('should not be able to create duplicate user', async ()=>{
        const inviteToken = getInviteToken();
        const req = new MockExpressRequest({
            method:'POST',
            headers: {
                'Content-Type':'application/json',
            },
            params: {
                inviteToken,
            },
            body:{
                'name': 'Test',
                'email': 'test@gmail.com',
                'password':'test123'
            }
        });
        const res = new MockExpressResponse();
        const userController = new UserController();
        await userController.create(req, res);
        await expect(userController.create(req, res)).rejects.toHaveProperty('statusCode', 400);
      
    });
    it('should not be able to create new user without email', async ()=>{
        const userController = new UserController();
        const inviteToken = getInviteToken();
        const req = new MockExpressRequest({
            method:'POST',
            headers: {
                'Content-Type':'application/json',
            },
            params: {
                inviteToken,
            },
            body:{
                'name': 'Test',
                'password':'test123'
            }
        });
        const res = new MockExpressResponse();
        await expect(userController.create(req, res)).rejects.toHaveProperty('statusCode', 400);
    });
    it('should not be able to create new user without password', async ()=>{
        const userController = new UserController();
        const inviteToken = getInviteToken();
        const req = new MockExpressRequest({
            method:'POST',
            headers: {
                'Content-Type':'application/json',
            },
            params: {
                inviteToken,
            },
            body:{
                'name': 'Test',
                'email': 'test@gmail.com'
            }
        });
        const res = new MockExpressResponse();
        await expect(userController.create(req, res)).rejects.toHaveProperty('statusCode', 400);
    });
    it('should not be able to create new user without name', async ()=>{
        const userController = new UserController();
        const inviteToken = getInviteToken();
        const req = new MockExpressRequest({
            method:'POST',
            headers: {
                'Content-Type':'application/json',
            },
            params: {
                inviteToken,
            },
            body:{
                'email': 'test@gmail.com',
                'password':'test123'
            }
        });
        const res = new MockExpressResponse();
        await expect(userController.create(req, res)).rejects.toHaveProperty('statusCode', 400);
    });
    it('should not be able to create new user with empty body', async ()=>{
        const userController = new UserController();
        const inviteToken = getInviteToken();
        const req = new MockExpressRequest({
            method:'POST',
            headers: {
                'Content-Type':'application/json',
            },
            params: {
                inviteToken,
            },
            body:{}
        });
        const res = new MockExpressResponse();
        await expect(userController.create(req, res)).rejects.toHaveProperty('statusCode', 400);
    });
});

describe('Create teacher by admin', () => {
    it('should be able to create teacher by admin', async () => {
        const userController = new UserController();
        const inviteToken = getInviteToken();
        const adminCreateReq = new MockExpressRequest({
            method:'POST',
            headers: {
                'Content-Type':'application/json',
            },
            params: {
                inviteToken,
            },
            body:{
                'name': 'Admin User',
                'email': 'admin@ufba.br',
                'password':'Admin123!'
            }
        });
        const adminCreateRes = new MockExpressResponse();
        await userController.create(adminCreateReq, adminCreateRes);

        const createdAdminId = adminCreateRes._getJSON().id;
        const userRepository = getCustomRepository(UserRepository);
        await userRepository
            .createQueryBuilder()
            .update('users')
            .set({ role: 'admin' })
            .where('id = :id', { id: createdAdminId })
            .execute();

        const req = new MockExpressRequest({
            method:'POST',
            headers: {
                authenticatedUserId: createdAdminId,
            },
            body:{
                name: 'Professor Claudio',
                email: 'claudio@ufba.br',
                sendCredentialsByEmail: false,
            },
        });
        const res = new MockExpressResponse();

        await userController.createTeacherByAdmin(req, res);

        expect(res.statusCode).toBe(201);
        expect(res._getJSON()).toHaveProperty('temporaryPassword');
        expect(res._getJSON()).toMatchObject({
            name: 'Professor Claudio',
            email: 'claudio@ufba.br',
        });
    });

    it('should not be able to create teacher by non-admin', async () => {
        const userController = new UserController();
        const inviteToken = getInviteToken();
        const teacherReq = new MockExpressRequest({
            method:'POST',
            headers: {
                'Content-Type':'application/json',
            },
            params: {
                inviteToken,
            },
            body:{
                'name': 'Teacher User',
                'email': 'teacher@ufba.br',
                'password':'Teacher123!'
            }
        });
        const teacherRes = new MockExpressResponse();
        await userController.create(teacherReq, teacherRes);

        const createdTeacherId = teacherRes._getJSON().id;

        const req = new MockExpressRequest({
            method:'POST',
            headers: {
                authenticatedUserId: createdTeacherId,
            },
            body:{
                name: 'Professor Ivan',
                email: 'ivan@ufba.br',
                sendCredentialsByEmail: false,
            },
        });
        const res = new MockExpressResponse();

        await expect(userController.createTeacherByAdmin(req, res)).rejects.toHaveProperty('statusCode', 401);
    });
});