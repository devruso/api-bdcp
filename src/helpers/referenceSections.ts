type ReferenceSections = {
    basic: string;
    complementary: string;
};

const BASIC_REGEX = /(?:REFERENCIAS\s+BASICAS|REFERÊNCIAS\s+BÁSICAS|BASICAS|BÁSICAS)\s*:\s*([\s\S]*?)(?=(?:REFERENCIAS\s+COMPLEMENTARES|REFERÊNCIAS\s+COMPLEMENTARES|COMPLEMENTARES)\s*:|$)/i;
const COMPLEMENTARY_REGEX = /(?:REFERENCIAS\s+COMPLEMENTARES|REFERÊNCIAS\s+COMPLEMENTARES|COMPLEMENTARES)\s*:\s*([\s\S]*)$/i;
const URL_REGEX = /(https?:\/\/[^\s)]+)(?=[)\].,;!?]*\s*$|[\s])/i;
const ACCESS_REGEX = /acesso\s+em\s*:/i;
const TIME_REGEX = /\b\d{2}:\d{2}\b/;
const YEAR_REGEX = /\b(19|20)\d{2}\b/;

const clean = (value?: string) => String(value || '').trim();

const ensureTrailingPeriod = (value: string) => {
    const normalized = value.trim();

    if (!normalized) {
        return normalized;
    }

    if (/[.!?]$/.test(normalized)) {
        return normalized;
    }

    return `${normalized}.`;
};

const toAccessStamp = (date = new Date()) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}`;
};

const formatAbntReferenceLine = (line: string, date = new Date()) => {
    const normalized = clean(line).replace(/\s+/g, ' ');

    if (!normalized) {
        return '';
    }

    const urlMatch = normalized.match(URL_REGEX);

    if (!urlMatch) {
        return normalized;
    }

    const url = clean(urlMatch[1]);

    if (ACCESS_REGEX.test(normalized) && TIME_REGEX.test(normalized)) {
        return normalized;
    }

    const withoutUrl = normalized.replace(url, '').replace(/\s+/g, ' ').trim();
    const cleanedBase = withoutUrl
        .replace(/dispon[ií]vel\s+em\s*:/gi, '')
        .replace(/acesso\s+em\s*:/gi, '')
        .replace(/[;,:]+$/g, '')
        .trim();

    const descriptor = ensureTrailingPeriod(cleanedBase || 'Recurso online');

    return `${descriptor} Disponivel em: ${url}. Acesso em: ${toAccessStamp(date)}.`;
};

export const formatAbntReferenceBlock = (value?: string, date = new Date()) => String(value || '')
    .split(/\r?\n/)
    .map((line) => formatAbntReferenceLine(line, date))
    .filter((line) => line.length > 0)
    .filter((line, index, arr) => arr.indexOf(line) === index)
    .join('\n');

const splitUniqueReferenceLines = (value?: string) => formatAbntReferenceBlock(value)
    .split(/\r?\n/)
    .map((line) => clean(line).replace(/\s+/g, ' '))
    .filter((line) => line.length > 0)
    .filter((line, index, arr) => arr.indexOf(line) === index);

export const normalizeReferenceSections = (basic?: string, complementary?: string): ReferenceSections => {
    const normalizedBasicLines = splitUniqueReferenceLines(basic);
    const normalizedComplementaryLines = splitUniqueReferenceLines(complementary)
        .filter((line) => !normalizedBasicLines.includes(line));

    return {
        basic: normalizedBasicLines.join('\n'),
        complementary: normalizedComplementaryLines.join('\n'),
    };
};

export const hasNonWebReferenceWithoutYear = (value?: string) => {
    const lines = String(value || '')
        .split(/\r?\n/)
        .map((line) => clean(line).replace(/\s+/g, ' '))
        .filter((line) => line.length > 0);

    return lines.some((line) => !URL_REGEX.test(line) && !YEAR_REGEX.test(line));
};

export const splitBibliographySections = (rawBibliography?: string): ReferenceSections => {
    const raw = clean(rawBibliography);

    if (!raw) {
        return {
            basic: '',
            complementary: '',
        };
    }

    const basicMatch = raw.match(BASIC_REGEX);
    const complementaryMatch = raw.match(COMPLEMENTARY_REGEX);

    if (basicMatch || complementaryMatch) {
        return {
            basic: clean(basicMatch?.[1]),
            complementary: clean(complementaryMatch?.[1]),
        };
    }

    return {
        basic: raw,
        complementary: '',
    };
};

export const composeBibliographySections = (basic?: string, complementary?: string) => {
    const normalizedSections = normalizeReferenceSections(basic, complementary);
    const normalizedBasic = clean(normalizedSections.basic);
    const normalizedComplementary = clean(normalizedSections.complementary);

    if (!normalizedBasic && !normalizedComplementary) {
        return '';
    }

    return [
        `REFERENCIAS BASICAS:\n${normalizedBasic || 'Nao informado.'}`,
        `REFERENCIAS COMPLEMENTARES:\n${normalizedComplementary || 'Nao informado.'}`,
    ].join('\n\n');
};
