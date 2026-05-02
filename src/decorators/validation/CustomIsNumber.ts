import { isNumber, IsNumberOptions, ValidationOptions, registerDecorator } from 'class-validator';

export const CustomIsNumber = (options?: IsNumberOptions,validationOptions?: ValidationOptions) => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return (object: Object, propertyName: string) => {
        registerDecorator({
            name: 'customIsNumber',
            target: object.constructor,
            constraints: [ options ],
            propertyName,
            options: validationOptions,
            validator: {
                validate: (value, args): boolean => isNumber(value, args?.constraints[0]),
                defaultMessage: () => `${propertyName} deve ser um número`
            }
        });
    };
};
