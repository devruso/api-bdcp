import { IsString } from 'class-validator';

export class RefreshTokenRequestDto {
    @IsString({ message: 'refreshToken deve ser informado' })
    refreshToken!: string;
}
