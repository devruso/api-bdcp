import { min, ValidationOptions, registerDecorator } from 'class-validator';

export const CustomMin = (minValue: number, validationOptions?: ValidationOptions) => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return (object: Object, propertyName: string) => {
        registerDecorator({
            name: 'customMin',
            target: object.constructor,
            constraints: [ minValue ],
            propertyName,
            options: validationOptions,
            validator: {
                validate: (value, args): boolean => min(value, args?.constraints[0]),
                defaultMessage: () => `${propertyName} deve ser informado e diferente de string vazia`
            }
        });
    };
};
