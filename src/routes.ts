import { Router } from 'express';

import { authRouter } from './routers/AuthRouter';
import { componentRouter } from './routers/ComponentRouter';
import { userRouter } from './routers/UserRouter';
import { statusRouter } from './routers/HealthCheck';
import { componentDraftRouter } from './routers/ComponentDraftRouter';
import { userInviteRouter } from './routers/UserInviteRouter';

const router = Router();

router.use('/api/status', statusRouter);
router.use('/api/auth', authRouter);
router.use('/api/users', userRouter);
router.use('/api/invite', userInviteRouter);
router.use('/api/components', componentRouter);
router.use('/api/component-drafts', componentDraftRouter);

export { router };
