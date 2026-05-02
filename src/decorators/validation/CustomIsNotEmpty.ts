import { isNotEmpty, ValidationOptions, registerDecorator } from 'class-validator';

export const CustomIsNotEmpty = (validationOptions?: ValidationOptions) => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return (object: Object, propertyName: string) => {
        registerDecorator({
            name: 'customIsNotEmpty',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate: isNotEmpty,
                defaultMessage: () => `${propertyName} deve ser informado e deve ser diferente de string vazia`
            }
        });
    };
};
