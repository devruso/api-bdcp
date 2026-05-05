import { CustomIsNotEmpty, CustomMatches } from '../../decorators/validation';
import { UserRole } from '../../interfaces/UserRole';

export class UpdateUserRoleRequestDto {
    @CustomIsNotEmpty()
    @CustomMatches(/^(admin|teacher|super_admin)$/)
    public role: UserRole;
}
