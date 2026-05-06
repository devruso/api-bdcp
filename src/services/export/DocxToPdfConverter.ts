export type DocxToPdfConversionRequest = {
    docxBuffer: Buffer;
    fileBaseName: string;
};

export interface DocxToPdfConverter {
    convert(request: DocxToPdfConversionRequest): Buffer | null;
}
