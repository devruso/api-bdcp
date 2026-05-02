import multer from 'multer';
import { AppError } from '../errors/AppError';

const supportedMimeTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const uploadDraftImport = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
    },
    fileFilter: (_request, file, callback) => {
        if (!supportedMimeTypes.has(file.mimetype)) {
            callback(new AppError('Formato de arquivo nao suportado. Envie um PDF ou DOCX.', 400));
            return;
        }

        callback(null, true);
    },
});

export { uploadDraftImport };