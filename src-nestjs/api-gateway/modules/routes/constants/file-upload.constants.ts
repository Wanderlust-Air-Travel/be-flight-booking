/**
 * File upload constants
 */
export const FILE_UPLOAD_CONSTANTS = {
	MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
	ALLOWED_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png'],
	ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png'],
	UPLOAD_DIRECTORY: 'public/images/routes',
} as const;

