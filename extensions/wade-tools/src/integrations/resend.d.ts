export interface SendEmailParams {
    to: string[];
    subject: string;
    body?: string;
    html?: string;
    cc?: string[];
}
export declare function sendEmail(params: SendEmailParams): Promise<{
    id: string;
    to: string[];
    subject: string;
    timestamp: string;
}>;
