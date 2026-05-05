import { CustomIsNotEmpty, CustomMatches } from '../../../decorators/validation';
import { CustomIsDateString } from '../../../decorators/validation/CustomIsDateString';

export class ApproveDraftRequestDto {
    @CustomIsNotEmpty()
    @CustomIsDateString()
    public agreementDate: Date;

    @CustomIsNotEmpty()
    @CustomMatches(/^\d+$/)
    public agreementNumber: string;

    @CustomIsNotEmpty()
    @CustomMatches(/^.{6,}$/)
    public signature: string;
}