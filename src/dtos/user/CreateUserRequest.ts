import { CustomIsNotEmpty, CustomIsString, CustomIsEmail, CustomMatches } from '../../decorators/validation';

export class CreateUserRequestDto {
    @CustomIsNotEmpty()
    @CustomIsString()
    public name: string;

    @CustomIsNotEmpty()
    @CustomIsEmail()
    public email: string;

    @CustomIsNotEmpty()
    @CustomIsString()
    @CustomMatches(
        /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[*.!@$%&:;<>?_\-=+])[0-9a-zA-Z*.!@$%&:;<>?_\-=+]{8,20}$/,
        { message: 
            'A senha deve ter entre 8 e 20 caracters, deve conter um número, uma letra maiúscula, ' + 
            'uma letra minúscula e um caracter especial !.*$%&:;<>,.?_+=-'
        }
    )
    public password: string;
}