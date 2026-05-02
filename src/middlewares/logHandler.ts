/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';

export function logHandler(req: Request, res: Response, next: NextFunction): void {
    const startTime = new Date();

    const { send } = res;
    res.send = (c) => {
        res.send = send;
        (res as any).content = c;
        return res.send(c);
    };

    res.on('finish', () => {
        const durationMs = new Date().getTime() - startTime.getTime();

        const reqRawBody = (req as any).rawBody;
        console.log(req.method, req.url, reqRawBody ? reqRawBody.length : 0, 'B', '=>', res.statusCode, '|', durationMs, 'ms');
    });

    next();
}
