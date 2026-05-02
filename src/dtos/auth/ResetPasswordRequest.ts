import { CustomIsNotEmpty, CustomIsString } from '../../decorators/validation';

export class ResetPasswordRequestDto {
    @CustomIsNotEmpty()
    @CustomIsString()
    public email: string;
}