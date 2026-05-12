import { CustomIsEmail, CustomIsNotEmpty, CustomIsString } from '../../decorators/validation';

export class SendInviteByEmailRequestDto {
    @CustomIsNotEmpty()
    @CustomIsEmail()
    public email: string;

    @CustomIsNotEmpty()
    @CustomIsString()
    public registrationBaseUrl: string;
}
