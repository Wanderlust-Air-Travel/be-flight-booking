/**
 * SQL Server Configuration Interface
 * Used for mssql connection configuration
 */
export interface SqlConfig {
	server: string;
	port: number;
	user: string | undefined;
	password: string | undefined;
	database?: string;
	options: {
		encrypt: boolean;
		trustServerCertificate: boolean;
		enableArithAbort: boolean;
	};
	connectionTimeout?: number;
	requestTimeout?: number;
}

