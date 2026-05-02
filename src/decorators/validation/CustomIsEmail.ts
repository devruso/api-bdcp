import { isEmail, ValidationOptions, registerDecorator } from 'class-validator';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CustomIsEmail = (options?: any,validationOptions?: ValidationOptions) => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return (object: Object, propertyName: string) => {
        registerDecorator({
            name: 'customIsEmail',
            target: object.constructor,
            constraints: [ options ],
            propertyName,
            options: validationOptions,
            validator: {
                validate: (value, args): boolean => isEmail(value, args?.constraints[0]),
                defaultMessage: () => `${propertyName} deve ser um endereço de email`
            }
        });
    };
};
