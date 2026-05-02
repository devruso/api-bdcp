import { JwtPayload, verify } from 'jsonwebtoken';

export const verifyAuthToken = (authToken: string) => {
    return verify(authToken, String(process.env.JWT_SECRET)) as JwtPayload;
};
