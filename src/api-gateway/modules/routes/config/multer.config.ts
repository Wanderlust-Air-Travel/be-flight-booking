import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { BadRequestException } from '@nestjs/common';
import { FILE_UPLOAD_CONSTANTS } from '../constants/file-upload.constants';

/**
 * Multer configuration for route image uploads
 */
export const multerConfig = {
	storage: diskStorage({
		destination: (req, file, cb) => {
			const uploadPath = join(process.cwd(), FILE_UPLOAD_CONSTANTS.UPLOAD_DIRECTORY);

			// Create directory if it doesn't exist
			if (!existsSync(uploadPath)) {
				mkdirSync(uploadPath, { recursive: true });
			}

			cb(null, uploadPath);
		},
		filename: (req, file, cb) => {
			const routeId = req.params.routeId;

			// Validate file extension
			const ext = extname(file.originalname).toLowerCase();
			if (!FILE_UPLOAD_CONSTANTS.ALLOWED_EXTENSIONS.includes(ext)) {
				cb(
					new BadRequestException(
						`Invalid file extension. Allowed extensions: ${FILE_UPLOAD_CONSTANTS.ALLOWED_EXTENSIONS.join(', ')}`,
					) as any,
					'',
				);
				return;
			}

			// File name = route_id + .jpg (always use .jpg to ensure standard format)
			cb(null, `${routeId}.jpg`);
		},
	}),
	fileFilter: (req, file, cb) => {
		// Validate MIME type
		if (!FILE_UPLOAD_CONSTANTS.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
			cb(
				new BadRequestException(
					`Invalid file type. Allowed types: ${FILE_UPLOAD_CONSTANTS.ALLOWED_MIME_TYPES.join(', ')}`,
				),
				false,
			);
			return;
		}
		cb(null, true);
	},
	limits: {
		fileSize: FILE_UPLOAD_CONSTANTS.MAX_FILE_SIZE,
	},
};

