import { matches, ValidationOptions, registerDecorator } from 'class-validator';

export const CustomMatches = (pattern: RegExp, validationOptions?: ValidationOptions) => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return (object: Object, propertyName: string) => {
        registerDecorator({
            name: 'customMatches',
            target: object.constructor,
            propertyName,
            constraints: [ pattern ],
            options: validationOptions,
            validator: {
                validate: (value, args): boolean => matches(value, args?.constraints[0], args?.constraints[1]),
                defaultMessage: () => `${propertyName} deve estar de acordo com a expressão regular ${pattern}`
            }
        });
    };
};
