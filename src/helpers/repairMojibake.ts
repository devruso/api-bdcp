const MOJIBAKE_MARKER_REGEX = /[ÃÂâ]|[\u0080-\u009f]/u;
const REPLACEMENT_CHAR_REGEX = /�/gu;
const CONTROL_CHAR_REGEX = /[\u0000-\b\u000b\f\u000e-\u001f\u0080-\u009f]/gu;
const UTF8_MOJIBAKE_REGEX = /(Ã.|Â.|â.)/gu;

export function getTextCorruptionScore(value: string): number {
    const replacementCount = (value.match(REPLACEMENT_CHAR_REGEX) || []).length;
    const mojibakeCount = (value.match(UTF8_MOJIBAKE_REGEX) || []).length;
    const controlCount = (value.match(CONTROL_CHAR_REGEX) || []).length;

    return (replacementCount * 10) + (mojibakeCount * 4) + (controlCount * 3);
}

export function repairLikelyUtf8Mojibake(rawValue: string): string {
    if (!rawValue || !MOJIBAKE_MARKER_REGEX.test(rawValue)) {
        return rawValue;
    }

    const repairedValue = Buffer.from(rawValue, 'latin1').toString('utf8');

    return getTextCorruptionScore(repairedValue) < getTextCorruptionScore(rawValue)
        ? repairedValue
        : rawValue;
}