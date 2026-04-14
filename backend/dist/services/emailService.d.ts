interface EmailOptions {
    from?: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
}
declare const sendEmail: (options: EmailOptions) => Promise<import("nodemailer/lib/smtp-transport").SentMessageInfo>;
export default sendEmail;
