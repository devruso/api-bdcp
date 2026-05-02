import { isDateString, ValidationOptions, registerDecorator } from 'class-validator';

export const CustomIsDateString = (validationOptions?: ValidationOptions) => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return (object: Object, propertyName: string) => {
        registerDecorator({
            name: 'customIsDateString',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate: isDateString,
                defaultMessage: () => `${propertyName} deve ser uma data`
            }
        });
    };
};
