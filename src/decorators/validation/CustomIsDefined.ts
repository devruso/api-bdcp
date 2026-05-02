import { isDefined, ValidationOptions, registerDecorator } from 'class-validator';

export const CustomIsDefined = (validationOptions?: ValidationOptions) => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return (object: Object, propertyName: string) => {
        registerDecorator({
            name: 'customIsDefined',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate: isDefined,
                defaultMessage: () => `${propertyName} deve ser informado`
            }
        });
    };
};
