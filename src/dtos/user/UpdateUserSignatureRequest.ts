import { CustomIsNotEmpty, CustomIsString } from '../../decorators/validation';

export class UpdateUserSignatureRequestDto {
    @CustomIsNotEmpty()
    @CustomIsString()
    public signature: string;
}
