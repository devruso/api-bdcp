import { UserController } from '../controllers/UserController';
import { UserInviteService } from '../services/UserInviteService';
import connection from './connection';
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