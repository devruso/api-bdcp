import { IsBoolean, IsOptional } from 'class-validator';
import { CustomIsEmail, CustomIsNotEmpty, CustomIsString } from '../../decorators/validation';

export class CreateTeacherByAdminRequestDto {
    @CustomIsNotEmpty()
    @CustomIsString()
    public name: string;

    @CustomIsNotEmpty()
    @CustomIsEmail()
    public email: string;

    @IsOptional()
    @IsBoolean()
    public sendCredentialsByEmail?: boolean;
}