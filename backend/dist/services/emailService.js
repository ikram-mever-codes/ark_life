"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const createTransporter = () => {
    return nodemailer_1.default.createTransport({
        service: "gmail",
        secure: true,
        port: 465,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        tls: {
            // ⚠️ Only use this in development!
            rejectUnauthorized: false,
        },
    });
};
const sendEmail = async (options) => {
    const transporter = createTransporter();
    try {
        // Use a proper from format with name and email
        const fromAddress = options.from || `"ArkLife" <${process.env.EMAIL_USER}>`;
        const mailOptions = {
            from: fromAddress,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            headers: {
                "X-Priority": "3",
                "X-Mailer": "Your App",
                ...options.headers,
            },
        };
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully to:", options.to);
        console.log("Message ID:", info.messageId);
        return info;
    }
    catch (error) {
        console.error("Error sending email:", error);
        throw new Error("Failed to send email. Please try again.");
    }
};
exports.default = sendEmail;
//# sourceMappingURL=emailService.js.map