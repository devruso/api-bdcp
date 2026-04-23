import nodemailer from 'nodemailer';

class MailerService{
    async execute(to: string, subject: string, text: string){
        const isMailerMockEnabled = process.env.MAILER_MOCK === 'true';

        if (isMailerMockEnabled) {
            console.log('[MAILER_MOCK] Email sending skipped.');
            console.log({ to, subject, text });
            return;
        }

        if (!process.env.MAILER_USER || !process.env.MAILER_PASSWORD) {
            throw new Error('Mailer credentials are missing. Set MAILER_USER/MAILER_PASSWORD or enable MAILER_MOCK=true.');
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.MAILER_USER,
                pass: process.env.MAILER_PASSWORD,
            },
            tls: {
                rejectUnauthorized: false,
            }
        });

        const mailSent = await transporter.sendMail({
            to,
            subject,
            text,
            from: 'BDCP-IC-UFBA <bdcpicufba@gmail.com>',
        });

        console.log('Password Reset was requested. Message ID: ', mailSent.messageId);
    }

}

export default new MailerService();
