import { isString, ValidationOptions, registerDecorator } from 'class-validator';

export const CustomIsString = (validationOptions?: ValidationOptions) => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return (object: Object, propertyName: string) => {
        registerDecorator({
            name: 'customIsString',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate: isString,
                defaultMessage: () => `${propertyName} deve ser uma string`
            }
        });
    };
};
