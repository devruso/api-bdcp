import { CustomIsNotEmpty, CustomMatches } from '../../../decorators/validation';
import { CustomIsDateString } from '../../../decorators/validation/CustomIsDateString';

export class ApproveDraftRequestDto {
    @CustomIsNotEmpty()
    @CustomIsDateString()
    public agreementDate: Date;

    @CustomIsNotEmpty()
    @CustomMatches(/^[A-Za-z0-9À-ÿ./\-\s]+$/)
    public agreementNumber: string;

    @CustomIsNotEmpty()
    @CustomMatches(/^.{6,}$/)
    public signature: string;
}