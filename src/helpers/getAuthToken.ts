export const getAuthToken = (authorization?: string) => {
    const splitToken = authorization?.split('Bearer ');
    const authToken = splitToken?.[1];

    if (!splitToken || splitToken.length < 2 || !authToken) {
        return undefined;
    }

    return authToken;
};
