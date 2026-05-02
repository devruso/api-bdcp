import { CustomIsNotEmpty, CustomIsString } from '../../decorators/validation';

export class LoginRequestDto {
    @CustomIsNotEmpty()
    @CustomIsString()
    public email: string;

    @CustomIsNotEmpty()
    @CustomIsString()
    public password: string;
}