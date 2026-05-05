export const normalizeEmail = (email: string) => String(email || '').trim().toLowerCase();

export const isUfbaInstitutionalEmail = (email: string) => {
    const normalized = normalizeEmail(email);

    return /@([a-z0-9-]+\.)*ufba\.br$/i.test(normalized);
};

export const assertUfbaInstitutionalEmail = (email: string) => {
    if (!isUfbaInstitutionalEmail(email)) {
        return false;
    }

    return true;
};
